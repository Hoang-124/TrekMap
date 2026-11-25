import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { WeatherAlertSubModel, type IWeatherAlertSub, type WeatherAlertVerdict } from '../models/WeatherAlertSub.js';
import { UserModel } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { isValidObjectId, resolveTrailByIdOrSlug } from '../utils/resolveTrail.js';
import { computeTrailGoNoGo, getVietnamTodayIso, isValidCalendarDateIso } from '../services/goNoGo.service.js';
import { sendNotification } from '../utils/notification.js';

const MAX_SUBS_PER_USER = 10;
const EVAL_CONCURRENCY = 3;
const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6-hour per-channel atomic cooldown
const TRAIL_ID_REGEX = /^[a-zA-Z0-9_-]{2,80}$/;
const STRICT_NUMBER_STRING_REGEX = /^-?\d+(\.\d+)?$/;

export interface LiveWeatherAlertEvaluation {
  status: WeatherAlertVerdict;
  score: number;
  weatherAvailable: boolean;
  weatherOutOfRange: boolean;
  forecastWindowNote: string | null;
  seaOfCloudsPercent: number | null;
  rainMm: number | null;
  windKmh: number | null;
  tempMinC: number | null;
  matchedConditions: string[];
  alertTriggered: boolean;
}

export interface WeatherAlertSubItem {
  id: string;
  trailId: string;
  trailName: string;
  province: string;
  maxAltitudeM: number;
  targetDate: string | null;
  minSeaOfCloudsPct: number;
  maxRainMm: number;
  maxWindKmh: number;
  alertOnNoGo: boolean;
  isActive: boolean;
  lastEvaluatedAt: string | null;
  lastNotifiedAt: string | null;
  lastSafetyNotifiedAt: string | null;
  lastCloudNotifiedAt: string | null;
  lastVerdict: WeatherAlertVerdict | null;
  lastSeaOfCloudsPct: number | null;
  createdAt: string;
  updatedAt: string;
  liveEvaluation: LiveWeatherAlertEvaluation | null;
}

function parseStrictNumericRange(
  raw: unknown,
  fieldLabel: string,
  min: number,
  max: number
): { ok: true; value?: number } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  let num: number;
  if (typeof raw === 'number') {
    num = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || !STRICT_NUMBER_STRING_REGEX.test(trimmed)) {
      return { ok: false, message: `${fieldLabel} phải là số hợp lệ từ ${min} đến ${max}.` };
    }
    num = Number(trimmed);
  } else {
    return { ok: false, message: `${fieldLabel} phải là số hợp lệ từ ${min} đến ${max}.` };
  }

  if (!Number.isFinite(num) || num < min || num > max) {
    return { ok: false, message: `${fieldLabel} phải nằm trong khoảng ${min} đến ${max}.` };
  }
  return { ok: true, value: Math.round(num * 10) / 10 };
}

function parseStrictTargetDate(raw: unknown): { ok: true; value?: string | null } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Ngày khởi hành dự kiến không hợp lệ (định dạng YYYY-MM-DD).' };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || !isValidCalendarDateIso(trimmed)) {
    return { ok: false, message: 'Ngày khởi hành dự kiến không hợp lệ (định dạng YYYY-MM-DD thực tế).' };
  }
  const year = Number(trimmed.slice(0, 4));
  if (year < 2020 || year > 2035) {
    return { ok: false, message: 'Năm khởi hành phải nằm trong khoảng 2020 đến 2035.' };
  }
  return { ok: true, value: trimmed };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIdx = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIdx < items.length) {
        const idx = nextIdx++;
        results[idx] = await fn(items[idx]);
      }
    })
  );
  return results;
}

async function computeLiveAlertEvaluation(sub: {
  trailId: string;
  targetDate?: string | null;
  minSeaOfCloudsPct: number;
  maxRainMm: number;
  maxWindKmh: number;
  alertOnNoGo: boolean;
}): Promise<LiveWeatherAlertEvaluation | null> {
  const assessment = await computeTrailGoNoGo(sub.trailId, sub.targetDate || undefined).catch(() => null);
  if (!assessment) return null;

  const status: WeatherAlertVerdict = assessment.verdict;
  const score = Math.round(Number(assessment.score) || 0);
  const weather = assessment.weatherSummary;
  const factors = assessment.factors;
  const weatherAvailable = Boolean(weather);
  const weatherOutOfRange = Boolean(factors?.weatherOutOfRange);
  const forecastWindowNote =
    typeof factors?.forecastWindowNote === 'string' && factors.forecastWindowNote.trim()
      ? factors.forecastWindowNote.trim()
      : null;

  // Never fabricate 0°C / 0mm / 0% when live weather is unavailable or out-of-range (Rule 11)
  const rawCloud =
    typeof factors?.seaOfCloudsIndex === 'number'
      ? factors.seaOfCloudsIndex
      : typeof weather?.seaOfCloudsIndex === 'number'
        ? weather.seaOfCloudsIndex
        : null;
  const seaOfCloudsPercent =
    weatherAvailable && rawCloud !== null && Number.isFinite(rawCloud)
      ? Math.max(0, Math.min(100, Math.round(rawCloud)))
      : null;

  const rainMm =
    weatherAvailable && typeof weather?.precipMm === 'number' && Number.isFinite(weather.precipMm)
      ? Math.round(weather.precipMm * 10) / 10
      : null;

  const windKmh =
    weatherAvailable && typeof weather?.windSpeedKmH === 'number' && Number.isFinite(weather.windSpeedKmH)
      ? Math.round(weather.windSpeedKmH)
      : null;

  const rawTemp =
    typeof factors?.summitTempMinC === 'number' && Number.isFinite(factors.summitTempMinC)
      ? factors.summitTempMinC
      : typeof weather?.summitTempMinC === 'number' && Number.isFinite(weather.summitTempMinC)
        ? weather.summitTempMinC
        : typeof weather?.tempMinC === 'number' && Number.isFinite(weather.tempMinC)
          ? weather.tempMinC
          : null;
  const tempMinC = weatherAvailable && rawTemp !== null ? Math.round(rawTemp * 10) / 10 : null;

  const matchedConditions: string[] = [];

  if (sub.alertOnNoGo && status === 'NO_GO') {
    matchedConditions.push(
      `Cảnh báo NO-GO (${score}/100): Không khuyến khích xuất phát do thời tiết xấu hoặc cảnh báo thực địa.`
    );
  }

  if (weatherAvailable) {
    if (rainMm !== null && rainMm > sub.maxRainMm) {
      matchedConditions.push(`Lượng mưa vượt ngưỡng (${rainMm} mm > ${sub.maxRainMm} mm).`);
    }
    if (windKmh !== null && windKmh > sub.maxWindKmh) {
      matchedConditions.push(`Gió đỉnh vượt ngưỡng (${windKmh} km/h > ${sub.maxWindKmh} km/h).`);
    }
    if (
      status !== 'NO_GO' &&
      seaOfCloudsPercent !== null &&
      seaOfCloudsPercent >= sub.minSeaOfCloudsPct &&
      (rainMm === null || rainMm <= sub.maxRainMm) &&
      (windKmh === null || windKmh <= sub.maxWindKmh)
    ) {
      matchedConditions.push(
        `Cơ hội săn biển mây đẹp (${seaOfCloudsPercent}% >= ${sub.minSeaOfCloudsPct}%, mưa ${rainMm ?? 0} mm, gió ${windKmh ?? 0} km/h).`
      );
    }
  }

  return {
    status,
    score,
    weatherAvailable,
    weatherOutOfRange,
    forecastWindowNote,
    seaOfCloudsPercent,
    rainMm,
    windKmh,
    tempMinC,
    matchedConditions,
    alertTriggered: matchedConditions.length > 0,
  };
}

function serializeSub(
  doc: Partial<IWeatherAlertSub> & { _id: any },
  liveEvaluation: LiveWeatherAlertEvaluation | null
): WeatherAlertSubItem {
  return {
    id: String(doc._id),
    trailId: String(doc.trailId || ''),
    trailName: String(doc.trailName || ''),
    province: String(doc.province || ''),
    maxAltitudeM: Number(doc.maxAltitudeM) || 0,
    targetDate: doc.targetDate || null,
    minSeaOfCloudsPct: Number(doc.minSeaOfCloudsPct ?? 70),
    maxRainMm: Number(doc.maxRainMm ?? 10),
    maxWindKmh: Number(doc.maxWindKmh ?? 40),
    alertOnNoGo: doc.alertOnNoGo !== false,
    isActive: doc.isActive !== false,
    lastEvaluatedAt: doc.lastEvaluatedAt ? new Date(doc.lastEvaluatedAt).toISOString() : null,
    lastNotifiedAt: doc.lastNotifiedAt ? new Date(doc.lastNotifiedAt).toISOString() : null,
    lastSafetyNotifiedAt: doc.lastSafetyNotifiedAt ? new Date(doc.lastSafetyNotifiedAt).toISOString() : null,
    lastCloudNotifiedAt: doc.lastCloudNotifiedAt ? new Date(doc.lastCloudNotifiedAt).toISOString() : null,
    lastVerdict: (doc.lastVerdict as WeatherAlertVerdict) || null,
    lastSeaOfCloudsPct: typeof doc.lastSeaOfCloudsPct === 'number' ? doc.lastSeaOfCloudsPct : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    liveEvaluation,
  };
}

// GET /api/weather-alerts/me - List current user's weather alert subscriptions (bounded concurrency; skips live fetch on paused subs)
export const getMyWeatherAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để xem danh sách cảnh báo thời tiết.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const subs = await WeatherAlertSubModel.find({ userId: uid })
      .sort({ isActive: -1, updatedAt: -1 })
      .limit(MAX_SUBS_PER_USER)
      .lean();

    const data: WeatherAlertSubItem[] = await mapWithConcurrency(subs as any[], EVAL_CONCURRENCY, async (sub) => {
      if (sub.isActive === false) {
        return serializeSub(sub, null);
      }
      const liveEval = await computeLiveAlertEvaluation(sub);
      return serializeSub(sub, liveEval);
    });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      count: data.length,
      maxLimit: MAX_SUBS_PER_USER,
      data,
    });
  } catch (err) {
    console.error('[Get My Weather Alerts Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách cảnh báo thời tiết.' });
  }
};

// POST /api/weather-alerts - Create or update a trail's Sea-of-Clouds & Go/No-Go alert subscription (max 10/user)
export const upsertWeatherAlert = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để đăng ký cảnh báo thời tiết.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const body = req.body || {};
    const rawTrailId = typeof body.trailId === 'string' ? body.trailId.trim() : '';
    if (!rawTrailId || !TRAIL_ID_REGEX.test(rawTrailId)) {
      return res.status(400).json({ success: false, message: 'Mã cung đường không hợp lệ.' });
    }

    const trail: any = await resolveTrailByIdOrSlug(rawTrailId).catch(() => null);
    if (!trail || (trail.status && trail.status !== 'approved')) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cung đường đã duyệt để theo dõi thời tiết.' });
    }

    const dateRes = parseStrictTargetDate(body.targetDate);
    if (!dateRes.ok) return res.status(400).json({ success: false, message: dateRes.message });

    const cloudRes = parseStrictNumericRange(body.minSeaOfCloudsPct, 'Ngưỡng săn biển mây (%)', 30, 95);
    if (!cloudRes.ok) return res.status(400).json({ success: false, message: cloudRes.message });

    const rainRes = parseStrictNumericRange(body.maxRainMm, 'Ngưỡng mưa tối đa (mm)', 0, 100);
    if (!rainRes.ok) return res.status(400).json({ success: false, message: rainRes.message });

    const windRes = parseStrictNumericRange(body.maxWindKmh, 'Ngưỡng gió tối đa (km/h)', 10, 100);
    if (!windRes.ok) return res.status(400).json({ success: false, message: windRes.message });

    if (body.alertOnNoGo !== undefined && typeof body.alertOnNoGo !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Tham số alertOnNoGo phải là kiểu boolean.' });
    }
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Tham số isActive phải là kiểu boolean.' });
    }

    const uid = new Types.ObjectId(userId);
    const canonicalTrailId = String(trail.id || trail._id);
    const todayIso = getVietnamTodayIso();

    const existing: any = await WeatherAlertSubModel.findOne({ userId: uid, trailId: canonicalTrailId })
      .select('_id targetDate isActive')
      .lean();

    // Reject newly picked past departure dates; preserve unchanged legacy past targetDate when updating thresholds/pausing
    if (dateRes.value && dateRes.value < todayIso) {
      const isUnchangedExistingDate = Boolean(existing && existing.targetDate === dateRes.value);
      if (!isUnchangedExistingDate) {
        return res.status(400).json({
          success: false,
          message: `Ngày khởi hành dự kiến không thể là ngày đã qua (hôm nay là ${todayIso}).`,
        });
      }
    }

    const setFields: Record<string, any> = {
      trailName: String(trail.name || canonicalTrailId).slice(0, 160),
      province: String(trail.province || '').slice(0, 100),
      maxAltitudeM: Number(trail.maxAltitudeM) || 0,
    };

    if (dateRes.value !== undefined) setFields.targetDate = dateRes.value;
    if (cloudRes.value !== undefined) setFields.minSeaOfCloudsPct = Math.round(cloudRes.value);
    if (rainRes.value !== undefined) setFields.maxRainMm = rainRes.value;
    if (windRes.value !== undefined) setFields.maxWindKmh = Math.round(windRes.value);
    if (typeof body.alertOnNoGo === 'boolean') setFields.alertOnNoGo = body.alertOnNoGo;
    if (typeof body.isActive === 'boolean') setFields.isActive = body.isActive;

    // Reset notification cooldowns when user changes targetDate or re-enables a paused watch
    if (existing) {
      const targetDateChanged =
        dateRes.value !== undefined && (dateRes.value || null) !== (existing.targetDate || null);
      const reactivated = body.isActive === true && existing.isActive === false;
      if (targetDateChanged || reactivated) {
        setFields.lastNotifiedAt = null;
        setFields.lastSafetyNotifiedAt = null;
        setFields.lastCloudNotifiedAt = null;
      }
    }

    let doc: any = null;
    let isNewInsert = false;

    if (existing) {
      doc = await WeatherAlertSubModel.findOneAndUpdate(
        { _id: existing._id, userId: uid },
        { $set: setFields },
        { new: true, runValidators: true }
      ).lean();
    } else {
      const currentCount = await WeatherAlertSubModel.countDocuments({ userId: uid });
      if (currentCount >= MAX_SUBS_PER_USER) {
        return res.status(400).json({
          success: false,
          message: `Bạn chỉ có thể theo dõi tối đa ${MAX_SUBS_PER_USER} cung đường cùng lúc. Vui lòng hủy bớt một cảnh báo cũ.`,
        });
      }

      try {
        const created = await WeatherAlertSubModel.create({
          userId: uid,
          trailId: canonicalTrailId,
          trailName: setFields.trailName,
          province: setFields.province,
          maxAltitudeM: setFields.maxAltitudeM,
          targetDate: dateRes.value ?? null,
          minSeaOfCloudsPct: cloudRes.value !== undefined ? Math.round(cloudRes.value) : 70,
          maxRainMm: rainRes.value !== undefined ? rainRes.value : 10,
          maxWindKmh: windRes.value !== undefined ? Math.round(windRes.value) : 40,
          alertOnNoGo: typeof body.alertOnNoGo === 'boolean' ? body.alertOnNoGo : true,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        });
        doc = created.toObject();
        isNewInsert = true;
      } catch (createErr: any) {
        if (createErr?.code === 11000) {
          // Concurrent upsert for the SAME trail — update cleanly without triggering cap rollback
          doc = await WeatherAlertSubModel.findOneAndUpdate(
            { userId: uid, trailId: canonicalTrailId },
            { $set: setFields },
            { new: true, runValidators: true }
          ).lean();
        } else {
          throw createErr;
        }
      }
    }

    if (!doc) {
      return res.status(500).json({ success: false, message: 'Không thể lưu cảnh báo thời tiết.' });
    }

    // Deterministic parallel-burst cap enforcement (oldest 10 win; trims only surplus newest docs — zero mutual annihilation)
    if (isNewInsert) {
      const orderedSubs = await WeatherAlertSubModel.find({ userId: uid })
        .sort({ createdAt: 1, _id: 1 })
        .select('_id')
        .lean();
      if (orderedSubs.length > MAX_SUBS_PER_USER) {
        const surplusIds = orderedSubs.slice(MAX_SUBS_PER_USER).map((s) => s._id);
        const myIdStr = String(doc._id);
        const myDocIsSurplus = surplusIds.some((id) => String(id) === myIdStr);
        await WeatherAlertSubModel.deleteMany({ userId: uid, _id: { $in: surplusIds } });
        if (myDocIsSurplus) {
          return res.status(400).json({
            success: false,
            message: `Bạn chỉ có thể theo dõi tối đa ${MAX_SUBS_PER_USER} cung đường cùng lúc.`,
          });
        }
      }
    }

    let liveEval: LiveWeatherAlertEvaluation | null = null;
    if (doc.isActive !== false) {
      liveEval = await computeLiveAlertEvaluation(doc);
      if (liveEval && doc?._id) {
        const now = new Date();
        const stampFields: Record<string, any> = {
          lastEvaluatedAt: now,
          lastVerdict: liveEval.status,
        };
        // Never overwrite lastSeaOfCloudsPct with null/0 when live weather is unavailable
        if (liveEval.seaOfCloudsPercent !== null) {
          stampFields.lastSeaOfCloudsPct = liveEval.seaOfCloudsPercent;
        }
        await WeatherAlertSubModel.updateOne({ _id: doc._id, userId: uid }, { $set: stampFields }).catch(() => {});
        doc.lastEvaluatedAt = now;
        doc.lastVerdict = liveEval.status;
        if (liveEval.seaOfCloudsPercent !== null) {
          doc.lastSeaOfCloudsPct = liveEval.seaOfCloudsPercent;
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(isNewInsert ? 201 : 200).json({
      success: true,
      message: isNewInsert
        ? `Đã bật theo dõi săn mây & an toàn Go/No-Go cho ${doc.trailName}!`
        : `Đã cập nhật ngưỡng cảnh báo thời tiết cho ${doc.trailName}!`,
      data: serializeSub(doc, liveEval),
    });
  } catch (err) {
    console.error('[Upsert Weather Alert Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu cảnh báo thời tiết.' });
  }
};

// DELETE /api/weather-alerts/:trailId - Unsubscribe from a trail's weather alert (strict owner)
export const deleteWeatherAlert = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const rawTrailId = String(req.params.trailId || '').trim();
    if (!rawTrailId || !TRAIL_ID_REGEX.test(rawTrailId)) {
      return res.status(400).json({ success: false, message: 'Mã cung đường không hợp lệ.' });
    }

    const candidateIds = new Set<string>([rawTrailId]);
    const resolved: any = await resolveTrailByIdOrSlug(rawTrailId).catch(() => null);
    if (resolved) {
      if (resolved.id) candidateIds.add(String(resolved.id));
      if (resolved._id) candidateIds.add(String(resolved._id));
    }

    const uid = new Types.ObjectId(userId);
    const deleted = await WeatherAlertSubModel.findOneAndDelete({
      userId: uid,
      trailId: { $in: Array.from(candidateIds) },
    }).lean();

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo thời tiết cho cung đường này.' });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      message: `Đã hủy cảnh báo thời tiết cho ${deleted.trailName}.`,
    });
  } catch (err) {
    console.error('[Delete Weather Alert Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi hủy cảnh báo thời tiết.' });
  }
};

const BACKGROUND_SWEEP_BATCH_LIMIT = 100;

async function evaluateAndDispatchSingleSub(
  sub: any,
  now: Date,
  todayIso: string,
  cooldownCutoff: Date
): Promise<{ item: WeatherAlertSubItem; notified: boolean; evaluated: boolean }> {
  try {
    const rawUid = sub?.userId ? String(sub.userId) : '';
    if (!Types.ObjectId.isValid(rawUid)) {
      return { item: serializeSub(sub, null), notified: false, evaluated: false };
    }
    const uid = new Types.ObjectId(rawUid);

    const isExpiredTargetDate = Boolean(sub.targetDate && sub.targetDate < todayIso);
    if (isExpiredTargetDate) {
      await WeatherAlertSubModel.updateOne(
        { _id: sub._id, userId: uid },
        { $set: { lastEvaluatedAt: now } }
      ).catch(() => {});
      return {
        item: serializeSub({ ...sub, lastEvaluatedAt: now }, null),
        notified: false,
        evaluated: false,
      };
    }

    const liveEval = await computeLiveAlertEvaluation(sub);
    if (!liveEval) {
      return { item: serializeSub(sub, null), notified: false, evaluated: false };
    }

    const evalStamp: Record<string, any> = {
      lastEvaluatedAt: now,
      lastVerdict: liveEval.status,
    };
    if (liveEval.seaOfCloudsPercent !== null) {
      evalStamp.lastSeaOfCloudsPct = liveEval.seaOfCloudsPercent;
    }

    if (liveEval.alertTriggered) {
      const isSafetyDanger =
        (sub.alertOnNoGo && liveEval.status === 'NO_GO') ||
        (liveEval.rainMm !== null && liveEval.rainMm > sub.maxRainMm) ||
        (liveEval.windKmh !== null && liveEval.windKmh > sub.maxWindKmh);

      // Separate safety vs cloud cooldown fields so morning Sea-of-Clouds alerts NEVER suppress emergency NO_GO alerts
      const cooldownField = isSafetyDanger ? 'lastSafetyNotifiedAt' : 'lastCloudNotifiedAt';
      const prevChannelNotifiedAt = (isSafetyDanger ? sub.lastSafetyNotifiedAt : sub.lastCloudNotifiedAt) ?? null;
      const prevLastNotifiedAt = sub.lastNotifiedAt ?? null;

      const claimed: any = await WeatherAlertSubModel.findOneAndUpdate(
        {
          _id: sub._id,
          userId: uid,
          $or: [
            { [cooldownField]: null },
            { [cooldownField]: { $exists: false } },
            { [cooldownField]: { $lte: cooldownCutoff } },
          ],
        },
        { $set: { ...evalStamp, [cooldownField]: now, lastNotifiedAt: now } },
        { new: true }
      ).lean();

      if (claimed) {
        const dateTag = sub.targetDate ? ` (${sub.targetDate})` : '';
        const title = isSafetyDanger
          ? `Cảnh báo Thời tiết & An toàn: ${sub.trailName}${dateTag}`
          : `Cơ hội Săn Biển Mây ${liveEval.seaOfCloudsPercent ?? ''}%: ${sub.trailName}${dateTag}`;
        const tempSnippet = liveEval.tempMinC !== null ? ` Nhiệt độ đỉnh ~${liveEval.tempMinC}°C,` : '';
        const message = `${liveEval.matchedConditions.join(' ')}${tempSnippet} điểm Go/No-Go ${liveEval.score}/100.`;

        let createdNotif: any = null;
        try {
          createdNotif = await sendNotification({
            recipientId: uid,
            sender: {
              id: 'lost-weather-radar',
              name: 'Radar Thời Tiết LOST',
              avatarUrl: '',
            },
            type: isSafetyDanger ? 'safety_alert' : 'system',
            category: 'safety',
            title,
            message,
            link: `/trails/${sub.trailId}`,
            relatedId: `weather-alert:${sub.trailId}`,
          });
        } catch {
          createdNotif = null;
        }

        if (createdNotif) {
          return { item: serializeSub(claimed, liveEval), notified: true, evaluated: true };
        }

        // CAS rollback so failed sendNotification never poisons the 6h cooldown window
        await WeatherAlertSubModel.updateOne(
          { _id: sub._id, userId: uid, [cooldownField]: now },
          { $set: { [cooldownField]: prevChannelNotifiedAt, lastNotifiedAt: prevLastNotifiedAt } }
        ).catch(() => {});
        return {
          item: serializeSub(
            { ...claimed, [cooldownField]: prevChannelNotifiedAt, lastNotifiedAt: prevLastNotifiedAt },
            liveEval
          ),
          notified: false,
          evaluated: true,
        };
      }
    }

    await WeatherAlertSubModel.updateOne({ _id: sub._id, userId: uid }, { $set: evalStamp }).catch(() => {});
    return { item: serializeSub({ ...sub, ...evalStamp }, liveEval), notified: false, evaluated: true };
  } catch (itemErr) {
    console.warn('[Evaluate Single Weather Alert Warning]:', (itemErr as Error)?.message || itemErr);
    return { item: serializeSub(sub, null), notified: false, evaluated: false };
  }
}

/**
 * Automated background sweeper for scheduled weather & sea-of-clouds alert subscriptions.
 * Queries up to 100 active non-expired subs oldest-evaluated first, evaluates with concurrency 3,
 * enforces separate atomic 6h per-channel cooldowns + CAS rollback, and dispatches via sendNotification().
 */
export async function processScheduledWeatherAlerts(): Promise<{ evaluated: number; notified: number }> {
  if (mongoose.connection.readyState !== 1) {
    return { evaluated: 0, notified: 0 };
  }

  const now = new Date();
  const todayIso = getVietnamTodayIso(now);
  const cooldownCutoff = new Date(now.getTime() - NOTIFY_COOLDOWN_MS);

  const activeSubs = await WeatherAlertSubModel.find({
    isActive: true,
    $or: [
      { targetDate: null },
      { targetDate: { $exists: false } },
      { targetDate: { $gte: todayIso } },
    ],
  })
    .sort({ lastEvaluatedAt: 1, updatedAt: 1 })
    .limit(BACKGROUND_SWEEP_BATCH_LIMIT)
    .lean();

  if (activeSubs.length === 0) {
    return { evaluated: 0, notified: 0 };
  }

  // Skip alerts belonging to banned or deleted accounts so cron doesn't waste MET Norway quota
  const uniqueUserIds = Array.from(
    new Set(activeSubs.map((s: any) => String(s.userId || '')).filter((uid) => Types.ObjectId.isValid(uid)))
  ).map((uid) => new Types.ObjectId(uid));

  const validUsers =
    uniqueUserIds.length > 0
      ? await UserModel.find({ _id: { $in: uniqueUserIds }, isBanned: { $ne: true } })
          .select('_id')
          .lean()
      : [];
  const validUserIdSet = new Set(validUsers.map((u: any) => String(u._id)));

  const eligibleSubs: any[] = [];
  const staleSubIds: any[] = [];
  for (const sub of activeSubs as any[]) {
    if (validUserIdSet.has(String(sub.userId || ''))) {
      eligibleSubs.push(sub);
    } else if (sub._id) {
      staleSubIds.push(sub._id);
    }
  }

  if (staleSubIds.length > 0) {
    await WeatherAlertSubModel.updateMany(
      { _id: { $in: staleSubIds } },
      { $set: { isActive: false, lastEvaluatedAt: now } }
    ).catch(() => {});
  }

  if (eligibleSubs.length === 0) {
    return { evaluated: 0, notified: 0 };
  }

  const outcomes = await mapWithConcurrency(eligibleSubs, EVAL_CONCURRENCY, (sub) =>
    evaluateAndDispatchSingleSub(sub, now, todayIso, cooldownCutoff)
  );

  let evaluated = 0;
  let notified = 0;
  for (const outcome of outcomes) {
    if (outcome.evaluated) evaluated += 1;
    if (outcome.notified) notified += 1;
  }

  return { evaluated, notified };
}

// POST /api/weather-alerts/evaluate - Evaluate all active subs for current user & dispatch real notifications
// Uses separate per-channel 6h atomic cooldowns (lastSafetyNotifiedAt vs lastCloudNotifiedAt) + CAS rollback on failure
export const evaluateMyWeatherAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để kiểm tra cảnh báo thời tiết.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }

    const uid = new Types.ObjectId(userId);
    const [totalCount, activeSubs] = await Promise.all([
      WeatherAlertSubModel.countDocuments({ userId: uid }),
      WeatherAlertSubModel.find({ userId: uid, isActive: true })
        .sort({ updatedAt: -1 })
        .limit(MAX_SUBS_PER_USER)
        .lean(),
    ]);

    const now = new Date();
    const todayIso = getVietnamTodayIso(now);
    const cooldownCutoff = new Date(now.getTime() - NOTIFY_COOLDOWN_MS);

    const outcomes = await mapWithConcurrency(activeSubs as any[], EVAL_CONCURRENCY, async (sub) => {
      // Preserve live evaluation visibility on expired dates for manual user refresh while still blocking notification dispatch
      const isExpiredTargetDate = Boolean(sub.targetDate && sub.targetDate < todayIso);
      if (isExpiredTargetDate) {
        try {
          const liveEval = await computeLiveAlertEvaluation(sub);
          const evalStamp: Record<string, any> = liveEval
            ? {
                lastEvaluatedAt: now,
                lastVerdict: liveEval.status,
                ...(liveEval.seaOfCloudsPercent !== null ? { lastSeaOfCloudsPct: liveEval.seaOfCloudsPercent } : {}),
              }
            : { lastEvaluatedAt: now };
          await WeatherAlertSubModel.updateOne({ _id: sub._id, userId: uid }, { $set: evalStamp }).catch(() => {});
          return { item: serializeSub({ ...sub, ...evalStamp }, liveEval), notified: false, evaluated: Boolean(liveEval) };
        } catch {
          return { item: serializeSub(sub, null), notified: false, evaluated: false };
        }
      }
      return evaluateAndDispatchSingleSub(sub, now, todayIso, cooldownCutoff);
    });

    const data: WeatherAlertSubItem[] = outcomes.map((o) => o.item);
    const notificationsCreated = outcomes.reduce((sum, o) => sum + (o.notified ? 1 : 0), 0);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.json({
      success: true,
      evaluatedCount: data.length,
      totalCount,
      notificationsCreated,
      data,
    });
  } catch (err) {
    console.error('[Evaluate Weather Alerts Error]:', err);
    return res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra cảnh báo thời tiết thực địa.' });
  }
};
