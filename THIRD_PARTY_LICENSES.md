# THIRD-PARTY LICENSES & OPEN DATA ATTRIBUTIONS — LOST (d:\TrekMap)

© 2026 LOST Việt Nam. All Rights Reserved for original LOST application code, editorial design system, and original topographic cover artwork.

This product incorporates third-party open-source software, self-hosted open-source typography, vector icon geometries, and free commercial open geospatial/meteorological datasets. Every production dependency is verified free for commercial production use (100% OSI-approved permissive software licenses + SIL OFL 1.1 typography + ODbL / CC BY 4.0 / Public Domain open data).

For legal, privacy (Vietnam Decree 13/2023/ND-CP), or copyright takedown inquiries: **contact@lost.vn**.

---

## 1. Open Data, Map Tiles, 3D Elevation DEM, Weather & Satellite Attributions

| Provider | Usage in LOST | License | Required Attribution / Source |
| :--- | :--- | :--- | :--- |
| **OpenFreeMap** & **OpenMapTiles** | Vector 2D/3D map tiles & styles (`tiles.openfreemap.org`) | Permissive / Free Commercial | OpenFreeMap (https://openfreemap.org) · OpenMapTiles (https://openmaptiles.org) |
| **OpenStreetMap Contributors** | Map data, trail context & Nominatim reverse geocoding | **ODbL 1.0** (Open Database License) | © OpenStreetMap contributors (https://www.openstreetmap.org/copyright) |
| **AWS Open Data — Mapzen / Tilezen Terrarium DEM** | 3D Terrain heightmaps, 2D browser hillshade & server elevation profiles | **AWS Open Data / Public Domain & Open Sources** | Terrain: Mapzen/Tilezen (AWS Open Data, https://registry.opendata.aws/terrain-tiles/) · SRTM/NASA, USGS, NOAA, GMTED, ETOPO1 |
| **MET Norway** (Norwegian Meteorological Institute) | Live mountain weather forecasts (`api.met.no/weatherapi/locationforecast/2.0`) | **CC BY 4.0** | Weather data from MET Norway (CC BY 4.0, https://api.met.no/) |
| **NASA POWER** | 3-year historical summit climate archive (`power.larc.nasa.gov`) | **US Government Public Domain** | Climate archive: NASA POWER (Public Domain, https://power.larc.nasa.gov/) |
| **NASA GIBS** | Satellite imagery basemap (`gibs.earthdata.nasa.gov`, Blue Marble & VIIRS) | **US Government Public Domain** | Imagery: NASA GIBS (Public Domain, https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) |
| **NASA EONET** | Natural hazard & wildfire/storm event feeds (`eonet.gsfc.nasa.gov`) | **US Government Public Domain** | Natural events: NASA EONET (Public Domain, https://eonet.gsfc.nasa.gov/) |
| **OpenRouteService by HeiGIT** *(optional env key)* | Optional road routing (`api.openrouteservice.org`) | Free Commercial Tier | © openrouteservice by HeiGIT (https://openrouteservice.org/) \| © OpenStreetMap contributors |

---

## 2. Typography & Inline Vector Iconography

- **Plus Jakarta Sans** (`@fontsource-variable/plus-jakarta-sans@5.3.0`) — Copyright 2020 The Plus Jakarta Sans Project Authors (Tokotype, https://github.com/tokotype/PlusJakartaSans). Licensed under **SIL Open Font License 1.1 (OFL-1.1)**. Self-hosted as local `.woff2` files.
- **Feather Icons** (https://feathericons.com) — Copyright (c) 2013–2023 Cole Bemis. Licensed under the **MIT License**. Inline geometric SVG paths used in `client/src/components/common/SvgIcons.tsx`.
- **Lucide Icons** (https://lucide.dev) — Copyright (c) for portions of Lucide are held by Cole Bemis 2013–2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022–present. Licensed under the **ISC License**.

---

## 3. Client Production Dependencies (42 packages — MIT: 26, ISC: 8, BSD-2-Clause: 3, BSD-3-Clause: 3, OFL-1.1: 1, (MIT OR Apache-2.0): 1)

| Package | Version | Scope | License |
| :--- | :--- | :---: | :--- |
| `@fontsource-variable/plus-jakarta-sans` | `5.3.0` | Direct | OFL-1.1 |
| `@mapbox/jsonlint-lines-primitives` | `2.0.3` | Transitive | MIT |
| `@mapbox/point-geometry` | `1.1.0` | Transitive | ISC |
| `@mapbox/tiny-sdf` | `2.3.0` | Transitive | BSD-2-Clause |
| `@mapbox/unitbezier` | `1.0.0` | Transitive | BSD-2-Clause |
| `@mapbox/vector-tile` | `3.0.0` | Transitive | BSD-3-Clause |
| `@maplibre/geojson-vt` | `6.3.3` | Transitive | ISC |
| `@maplibre/maplibre-gl-style-spec` | `26.9.0` | Transitive | ISC |
| `@maplibre/mlt` | `1.3.0` | Transitive | (MIT OR Apache-2.0) |
| `@maplibre/vt-pbf` | `4.3.3` | Transitive | MIT |
| `@socket.io/component-emitter` | `3.1.2` | Transitive | MIT |
| `@types/geojson` | `7946.0.16` | Transitive | MIT |
| `@types/react` | `19.2.17` | Transitive | MIT |
| `bidi-js` | `1.1.0` | Transitive | MIT |
| `csstype` | `3.2.3` | Transitive | MIT |
| `debug` | `4.4.3` | Transitive | MIT |
| `earcut` | `3.2.4` | Transitive | ISC |
| `engine.io-client` | `6.6.6` | Transitive | MIT |
| `engine.io-parser` | `5.2.3` | Transitive | MIT |
| `gl-matrix` | `3.4.4` | Transitive | MIT |
| `json-stringify-pretty-compact` | `4.0.0` | Transitive | MIT |
| `kdbush` | `4.1.0` | Transitive | ISC |
| `leaflet` | `1.9.4` | Direct | BSD-2-Clause |
| `leaflet.markercluster` | `1.5.3` | Direct | MIT |
| `maplibre-gl` | `6.19.0` | Direct | BSD-3-Clause |
| `minimist` | `1.2.8` | Transitive | MIT |
| `ms` | `2.1.3` | Transitive | MIT |
| `murmurhash-js` | `1.0.0` | Transitive | MIT |
| `pbf` | `5.2.0` | Transitive | BSD-3-Clause |
| `potpack` | `2.1.0` | Transitive | ISC |
| `protocol-buffers-schema` | `3.6.1` | Transitive | MIT |
| `quickselect` | `3.0.0` | Transitive | ISC |
| `react` | `19.2.8` | Direct | MIT |
| `react-dom` | `19.2.8` | Direct | MIT |
| `require-from-string` | `2.0.2` | Transitive | MIT |
| `scheduler` | `0.27.0` | Transitive | MIT |
| `socket.io-client` | `4.8.3` | Direct | MIT |
| `socket.io-parser` | `4.2.7` | Transitive | MIT |
| `tinyqueue` | `3.0.0` | Transitive | ISC |
| `ws` | `8.21.1` | Transitive | MIT |
| `xmlhttprequest-ssl` | `2.1.2` | Transitive | MIT (verified via LICENSE file) |
| `zustand` | `5.1.0` | Transitive | MIT |

---

## 4. Server Production Dependencies (106 packages — MIT: 94, Apache-2.0: 4, ISC: 4, BSD-2-Clause: 2, MIT-0: 1, BSD-3-Clause: 1)

| Package | Version | Scope | License |
| :--- | :--- | :---: | :--- |
| `@mongodb-js/saslprep` | `1.4.13` | Transitive | MIT |
| `@socket.io/component-emitter` | `3.1.2` | Transitive | MIT |
| `@standard-schema/spec` | `1.1.0` | Transitive | MIT |
| `@types/cors` | `2.8.19` | Transitive | MIT |
| `@types/node` | `26.1.1` | Transitive | MIT |
| `@types/webidl-conversions` | `7.0.3` | Transitive | MIT |
| `@types/whatwg-url` | `13.0.0` | Transitive | MIT |
| `@types/ws` | `8.18.1` | Transitive | MIT |
| `accepts` | `1.3.8` | Transitive | MIT |
| `accepts` | `2.0.0` | Transitive | MIT |
| `base64id` | `2.0.0` | Transitive | MIT |
| `body-parser` | `2.3.0` | Transitive | MIT |
| `bson` | `7.3.1` | Transitive | Apache-2.0 |
| `bytes` | `3.1.2` | Transitive | MIT |
| `call-bind-apply-helpers` | `1.0.2` | Transitive | MIT |
| `call-bound` | `1.0.4` | Transitive | MIT |
| `cloudinary` | `2.10.0` | Direct | MIT |
| `content-disposition` | `1.1.0` | Transitive | MIT |
| `content-type` | `1.0.5` | Transitive | MIT |
| `content-type` | `2.0.0` | Transitive | MIT |
| `cookie` | `0.7.2` | Transitive | MIT |
| `cookie-signature` | `1.2.2` | Transitive | MIT |
| `cors` | `2.8.6` | Direct | MIT |
| `debug` | `4.4.3` | Transitive | MIT |
| `depd` | `2.0.0` | Transitive | MIT |
| `dotenv` | `17.4.2` | Direct | BSD-2-Clause |
| `dunder-proto` | `1.0.1` | Transitive | MIT |
| `ee-first` | `1.1.1` | Transitive | MIT |
| `encodeurl` | `2.0.0` | Transitive | MIT |
| `engine.io` | `6.6.9` | Transitive | MIT |
| `engine.io-parser` | `5.2.3` | Transitive | MIT |
| `es-define-property` | `1.0.1` | Transitive | MIT |
| `es-errors` | `1.3.0` | Transitive | MIT |
| `es-object-atoms` | `1.1.2` | Transitive | MIT |
| `escape-html` | `1.0.3` | Transitive | MIT |
| `etag` | `1.8.1` | Transitive | MIT |
| `express` | `5.2.1` | Direct | MIT |
| `finalhandler` | `2.1.1` | Transitive | MIT |
| `forwarded` | `0.2.0` | Transitive | MIT |
| `fresh` | `2.0.0` | Transitive | MIT |
| `function-bind` | `1.1.2` | Transitive | MIT |
| `get-intrinsic` | `1.3.0` | Transitive | MIT |
| `get-proto` | `1.0.1` | Transitive | MIT |
| `gopd` | `1.2.0` | Transitive | MIT |
| `has-symbols` | `1.1.0` | Transitive | MIT |
| `hasown` | `2.0.4` | Transitive | MIT |
| `http-errors` | `2.0.1` | Transitive | MIT |
| `iconv-lite` | `0.7.3` | Transitive | MIT |
| `inherits` | `2.0.4` | Transitive | ISC |
| `ipaddr.js` | `1.9.1` | Transitive | MIT |
| `is-promise` | `4.0.0` | Transitive | MIT |
| `kareem` | `3.3.0` | Transitive | Apache-2.0 |
| `lodash` | `4.18.1` | Transitive | MIT |
| `math-intrinsics` | `1.1.0` | Transitive | MIT |
| `media-typer` | `1.1.1` | Transitive | MIT |
| `memory-pager` | `1.5.0` | Transitive | MIT |
| `merge-descriptors` | `2.0.0` | Transitive | MIT |
| `mime-db` | `1.52.0` | Transitive | MIT |
| `mime-db` | `1.54.0` | Transitive | MIT |
| `mime-types` | `2.1.35` | Transitive | MIT |
| `mime-types` | `3.0.2` | Transitive | MIT |
| `mongodb` | `7.5.0` | Transitive | Apache-2.0 |
| `mongodb-connection-string-url` | `7.0.2` | Transitive | Apache-2.0 |
| `mongoose` | `9.8.0` | Direct | MIT |
| `mpath` | `0.9.0` | Transitive | MIT |
| `mquery` | `6.0.0` | Transitive | MIT |
| `ms` | `2.1.3` | Transitive | MIT |
| `negotiator` | `0.6.3` | Transitive | MIT |
| `negotiator` | `1.0.0` | Transitive | MIT |
| `nodemailer` | `9.0.3` | Direct | MIT-0 |
| `object-assign` | `4.1.1` | Transitive | MIT |
| `object-inspect` | `1.13.4` | Transitive | MIT |
| `on-finished` | `2.4.1` | Transitive | MIT |
| `once` | `1.4.0` | Transitive | ISC |
| `parseurl` | `1.3.3` | Transitive | MIT |
| `path-to-regexp` | `8.4.2` | Transitive | MIT |
| `proxy-addr` | `2.0.7` | Transitive | MIT |
| `punycode` | `2.3.1` | Transitive | MIT |
| `qs` | `6.15.3` | Transitive | BSD-3-Clause |
| `range-parser` | `1.3.0` | Transitive | MIT |
| `raw-body` | `3.0.2` | Transitive | MIT |
| `router` | `2.2.0` | Transitive | MIT |
| `safer-buffer` | `2.1.2` | Transitive | MIT |
| `send` | `1.2.1` | Transitive | MIT |
| `serve-static` | `2.2.1` | Transitive | MIT |
| `setprototypeof` | `1.2.0` | Transitive | ISC |
| `side-channel` | `1.1.1` | Transitive | MIT |
| `side-channel-list` | `1.0.1` | Transitive | MIT |
| `side-channel-map` | `1.0.1` | Transitive | MIT |
| `side-channel-weakmap` | `1.0.2` | Transitive | MIT |
| `sift` | `17.1.3` | Transitive | MIT |
| `socket.io` | `4.8.3` | Direct | MIT |
| `socket.io-adapter` | `2.5.8` | Transitive | MIT |
| `socket.io-parser` | `4.2.7` | Transitive | MIT |
| `sparse-bitfield` | `3.0.3` | Transitive | MIT |
| `statuses` | `2.0.2` | Transitive | MIT |
| `toidentifier` | `1.0.1` | Transitive | MIT |
| `tr46` | `5.1.1` | Transitive | MIT |
| `type-is` | `2.1.0` | Transitive | MIT |
| `undici-types` | `8.3.0` | Transitive | MIT |
| `unpipe` | `1.0.0` | Transitive | MIT |
| `vary` | `1.1.2` | Transitive | MIT |
| `webidl-conversions` | `7.0.0` | Transitive | BSD-2-Clause |
| `whatwg-url` | `14.2.0` | Transitive | MIT |
| `wrappy` | `1.0.2` | Transitive | ISC |
| `ws` | `8.21.1` | Transitive | MIT |

---

## 5. Full Verbatim Third-Party License Texts

### 5.1 Leaflet (`BSD-2-Clause`)
```text
BSD 2-Clause License

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 5.2 Leaflet.markercluster (`MIT`)
```text
Copyright 2012 David Leaver

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### 5.3 MapLibre GL JS (`BSD-3-Clause` + Embedded Mapbox GL JS v1.13, `glfx.js`, `d3-color`)
```text
Copyright (c) 2023, MapLibre contributors

All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.
    * Neither the name of MapLibre GL JS nor the names of its contributors
      may be used to endorse or promote products derived from this software
      without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


-------------------------------------------------------------------------------

Contains code from mapbox-gl-js v1.13 and earlier

Version v1.13 of mapbox-gl-js and earlier are licensed under a BSD-3-Clause license

Copyright (c) 2020, Mapbox
Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
* Neither the name of Mapbox GL JS nor the names of its contributors
  may be used to endorse or promote products derived from this software
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


-------------------------------------------------------------------------------

Contains code from glfx.js

Copyright (C) 2011 by Evan Wallace

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

--------------------------------------------------------------------------------

Contains a portion of d3-color https://github.com/d3/d3-color

Copyright 2010-2016 Mike Bostock
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the author nor the names of contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 5.4 Plus Jakarta Sans (`SIL Open Font License 1.1`)
```text
Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans) PlusJakartaSans-Italic[wght].ttf: Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### 5.5 React & React DOM (`MIT`)
```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 5.6 Socket.IO (`MIT`)
```text
The MIT License (MIT)

Copyright (c) 2014-present Guillermo Rauch and Socket.IO contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### 5.7 xmlhttprequest-ssl (`MIT` — manually verified from package LICENSE)
```text
Copyright (c) 2010 passive.ly LLC

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
```

### 5.8 Feather Icons (`MIT`) & Lucide Icons (`ISC`)
```text
ISC License (Lucide Icons)
Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee
is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE
INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING
OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### 5.9 dotenv (`BSD-2-Clause`)
```text
Copyright (c) 2015, Scott Motte
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 5.10 Nodemailer (`MIT-0`)
```text
Copyright (c) 2011-2023 Andris Reinman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 5.11 Apache License 2.0 Notice (MongoDB Node Driver, BSON, kareem, mongodb-connection-string-url, @maplibre/mlt)
```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use these files except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under the License
is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
```

---

## 6. Trademark Disclaimer

All third-party trademarks, product names, and national park or institutional names referenced in LOST belong to their respective owners. LOST is an independent outdoor community platform and is not officially affiliated with or endorsed by any third-party brand or government agency.
