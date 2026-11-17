import type { SvgSample } from '@/types/svg-generator';

const artwork = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${content}</svg>`;

/** Original editable vector studies. These are examples, not AI generations. */
export const SVG_SAMPLES: SvgSample[] = [
  {
    id: 'botanical',
    name: 'Wildflower study',
    category: 'Botanical illustration',
    prompt:
      'A sculptural coral wildflower with flowing sage green leaves, bold organic shapes, mid-century botanical illustration, transparent background',
    svg: artwork(`
      <path fill="#476653" d="M247 434c-1-47 4-83 15-121 10-34 18-57 10-91l13-4c9 37 2 64-9 101-10 35-15 72-14 115z"/>
      <path fill="#718C69" d="M254 397c-66 1-110-40-115-105 58 1 104 36 115 105z"/>
      <path fill="#476653" d="M254 397c-42-21-74-56-99-88 42 27 75 57 99 88z"/>
      <path fill="#99AC88" d="M263 351c4-64 44-107 110-111-3 64-44 106-110 111z"/>
      <path fill="#476653" d="M263 351c23-42 57-72 94-96-29 39-60 70-94 96z"/>
      <path fill="#718C69" d="M266 428c39-13 70-11 104 5-36 13-69 13-104-5z"/>
      <path fill="#E1744F" d="M265 193c-56-25-92-70-80-103 14-37 61-24 83 16 19-48 64-64 83-31 22 36-11 89-53 118z"/>
      <path fill="#D45535" d="M273 194c-52 17-110 4-121-31-11-36 29-63 71-42-9-46 19-82 50-61 32 22 37 77 20 129z"/>
      <path fill="#EF8C60" d="M274 193c-3-55 23-106 58-108 38-2 52 44 22 78 47 3 75 36 47 61-31 27-84 19-126-14z"/>
      <path fill="#D45535" d="M274 195c54-9 104 9 111 44 8 37-35 58-72 34 4 46-24 79-55 57-32-23-35-77-1-123z"/>
      <path fill="#E1744F" d="M272 195c23 50 17 102-16 118-34 17-63-19-46-62-43 14-82-6-67-39 16-36 67-52 116-31z"/>
      <path fill="#F1AF7E" d="M275 154c21 4 35 22 31 44s-23 38-45 33c-20-4-33-25-28-45 4-21 22-36 42-32z"/>
      <path fill="#393E30" d="M276 171c12 4 18 16 14 29-4 12-16 19-28 15-12-4-18-16-14-28 4-13 16-20 28-16z"/>
      <path fill="#F9DDB3" d="M266 180a4 4 0 1 1-1 8 4 4 0 0 1 1-8zm14 5a3 3 0 1 1-1 6 3 3 0 0 1 1-6zm-13 14a3 3 0 1 1-1 6 3 3 0 0 1 1-6z"/>
      <path fill="#99AC88" d="M243 438c-30-24-59-29-91-21 28 24 57 30 91 21z"/>
    `),
  },
  {
    id: 'orbit',
    name: 'Orbital forms',
    category: 'Abstract emblem',
    prompt:
      'An abstract cobalt blue orbital emblem, intersecting circular forms and a vermilion sun, clean geometric vector design, transparent background',
    svg: artwork(`
      <path fill="#3155B5" d="M256 78a178 178 0 1 0 0 356 178 178 0 0 0 0-356zm0 35a143 143 0 1 1 0 286 143 143 0 0 1 0-286z" fill-rule="evenodd"/>
      <path fill="#3155B5" d="M256 78c58 0 105 80 105 178s-47 178-105 178-105-80-105-178S198 78 256 78zm0 35c-38 0-70 64-70 143s32 143 70 143 70-64 70-143-32-143-70-143z" fill-rule="evenodd"/>
      <path fill="#3155B5" d="M78 256c0-58 80-105 178-105s178 47 178 105-80 105-178 105S78 314 78 256zm35 0c0 38 64 70 143 70s143-32 143-70-64-70-143-70-143 32-143 70z" fill-rule="evenodd"/>
      <path fill="#6F8BD1" d="M256 78a178 178 0 0 1 178 178h-35a143 143 0 0 0-143-143z"/>
      <path fill="#D85B39" d="M319 71a59 59 0 1 1 0 118 59 59 0 0 1 0-118z"/>
      <path fill="#F0A36B" d="M319 71a59 59 0 0 1 59 59h-59z"/>
      <path fill="#223969" d="M238 238h36v36h-36z"/>
      <path fill="#D85B39" d="M92 374a19 19 0 1 1 0 38 19 19 0 0 1 0-38z"/>
      <path fill="#E7C591" d="m395 367 8 21 22 8-22 8-8 22-8-22-22-8 22-8z"/>
    `),
  },
  {
    id: 'landscape',
    name: 'Desert daybreak',
    category: 'Landscape illustration',
    prompt:
      'A retro desert landscape with a golden rising sun, layered cobalt mountains and warm terracotta dunes, bold minimal vector poster shapes',
    svg: artwork(`
      <path fill="#EBD9AF" d="M100 66h312v380H100z"/>
      <path fill="#E9AB43" d="M294 123a72 72 0 1 1 0 144 72 72 0 0 1 0-144z"/>
      <path fill="#F8ECCA" d="M174 154h73v7h-73zm161 39h58v7h-58zm-211 23h57v7h-57z"/>
      <path fill="#6A86B3" d="m100 303 96-113 95 113 63-76 58 69v150H100z"/>
      <path fill="#35548D" d="m100 339 130-117 85 104 48-39 49 55v104H100z"/>
      <path fill="#203B68" d="m230 222 85 104-63-24-22 15z"/>
      <path fill="#D88350" d="M100 344c68-13 125 4 177 30 52 27 93 30 135 11v61H100z"/>
      <path fill="#B85B3A" d="M100 403c53-45 117-48 181-26 59 20 91 24 131 15v54H100z"/>
      <path fill="#E8AE6E" d="M100 430c70-22 129-10 184 16H100z"/>
      <path fill="#4D6251" d="M157 382v-49h-9v-11h9v-20h10v34h9v-17h9v26h-18v37z"/>
      <path fill="#4D6251" d="M349 426v-35h-10v-15h8v7h2v-20h9v37h9v-13h8v22h-17v17z"/>
      <path fill="#F8ECCA" d="M120 82h272v3H120zm0 342h3v2h-3z"/>
    `),
  },
  {
    id: 'butterfly',
    name: 'Papillon',
    category: 'Nature illustration',
    prompt:
      'A symmetrical butterfly with expressive terracotta and cobalt wings, elegant botanical specimen, simple layered vector shapes on a transparent background',
    svg: artwork(`
      <path fill="#D97145" d="M248 252C214 123 132 69 86 99c-41 27-7 142 85 180 31 13 59 13 77-27z"/>
      <path fill="#D97145" d="M264 252c34-129 116-183 162-153 41 27 7 142-85 180-31 13-59 13-77-27z"/>
      <path fill="#31579D" d="M244 263c-74-14-132 24-130 72 2 51 56 86 101 53 27-20 38-75 29-125z"/>
      <path fill="#31579D" d="M268 263c74-14 132 24 130 72-2 51-56 86-101 53-27-20-38-75-29-125z"/>
      <path fill="#F2BD7B" d="M222 242c-31-79-80-119-109-108-22 9 4 69 55 98 21 12 40 16 54 10z"/>
      <path fill="#F2BD7B" d="M290 242c31-79 80-119 109-108 22 9-4 69-55 98-21 12-40 16-54 10z"/>
      <path fill="#F3D8A1" d="M224 292c-36-8-67 10-65 37 2 26 21 41 39 24 13-13 21-34 26-61z"/>
      <path fill="#F3D8A1" d="M288 292c36-8 67 10 65 37-2 26-21 41-39 24-13-13-21-34-26-61z"/>
      <path fill="#263C3B" d="M249 224c-7 16-9 56-7 85 2 26 7 48 14 48s12-22 14-48c2-29 0-69-7-85z"/>
      <path fill="#263C3B" d="M256 200a14 14 0 1 1 0 28 14 14 0 0 1 0-28z"/>
      <path fill="none" stroke="#263C3B" stroke-width="5" stroke-linecap="round" d="M251 206c-2-23-11-32-23-36m33 36c2-23 11-32 23-36"/>
      <path fill="#263C3B" d="M103 117a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm306 0a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-276 211a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm246 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/>
    `),
  },
];
