import { Request, Response } from 'express';
import { getAiResponse, getContextualQuickPrompts, ChatRequestPayload } from '../services/ai.service.js';

/**
 * POST /api/ai/chat
 * Handle chat conversation with TrekCopilot AI
 */
export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory, currentTrailContext, userCoordinates } = req.body as ChatRequestPayload;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.',
      });
    }

    const response = await getAiResponse({
      message: message.trim(),
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      currentTrailContext,
      userCoordinates,
    });

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('[AI Controller] Chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xử lý yêu cầu với Trợ lý ảo. Vui lòng thử lại sau.',
      error: error?.message,
    });
  }
};

/**
 * GET /api/ai/quick-prompts
 * Get contextual quick prompts
 */
export const getQuickPrompts = async (req: Request, res: Response) => {
  try {
    const { trailName, province } = req.query;

    const prompts = getContextualQuickPrompts(
      trailName ? { name: String(trailName), province: province ? String(province) : undefined } : undefined
    );

    return res.status(200).json({
      success: true,
      data: prompts,
    });
  } catch (error: any) {
    console.error('[AI Controller] Quick prompts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách câu hỏi gợi ý.',
    });
  }
};
