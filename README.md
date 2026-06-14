# Configuration

## Environment Variables (.env)

Buat file `.env` pada root project.

### Example

```env
PORT=3000

ADMIN_USER=admin
ADMIN_PASS=password

API_KEY=your-secret-api-key

EXPRESS_SECRET=super-secret-session-key
```
---

# Header Configuration

Fitur Header digunakan untuk menampilkan preview card pada pesan WhatsApp menggunakan `externalAdReply`.

## File Thumbnail

Letakkan file thumbnail pada root project:

```text
project/
├── server.js
├── .env
├── tes.jpg
└── baileys/
```

---

## Mengubah Header

Cari bagian berikut pada file `server.js`:

```js
const contextInfo = isHeader ? {
  externalAdReply: {
    title: "Tes 1",
    body: "Tes 2",
    thumbnail: fs.readFileSync('./tes.jpg'),
    thumbnailUrl: "https://example.com",
    mediaUrl: "https://example.com",
    sourceUrl: "https://example.com",
    renderLargerThumbnail: true,
    showAdAttribution: true,
    mediaType: 1
  }
} : undefined;
```

---

# WhatsApp API Documentation

## Endpoint

```http
POST /api/send
```

### Headers

```http
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

---

# Send Text Message

### Request

```json
{
  "to": "628123456789",
  "type": "text",
  "text": "Halo dunia"
}
```

### Response

```json
{
  "ok": true,
  "type": "text",
  "to": "628123456789@s.whatsapp.net",
  "messageId": "MESSAGE_ID"
}
```

---

# Send Text Message With Header

### Request

```json
{
  "to": "628123456789",
  "type": "text",
  "text": "Halo dunia",
  "isHeader": true
}
```

### Notes

Jika `isHeader` bernilai `true`, maka pesan akan dikirim dengan Preview Header (`externalAdReply`) yang telah dikonfigurasi di server.

---

# Send Image

### Request

```json
{
  "to": "628123456789",
  "type": "image",
  "url": "https://example.com/image.jpg",
  "text": "Caption gambar"
}
```

### Notes

* `url` harus berupa URL gambar yang dapat diakses publik.
* `text` akan digunakan sebagai caption.

---

# Send Video

### Request

```json
{
  "to": "628123456789",
  "type": "video",
  "url": "https://example.com/video.mp4",
  "text": "Caption video"
}
```

### Notes

* `url` harus berupa URL video yang dapat diakses publik.
* `text` akan digunakan sebagai caption.

---

# Send Audio

### Request

```json
{
  "to": "628123456789",
  "type": "audio",
  "url": "https://example.com/audio.mp3"
}
```

### Notes

* `url` harus berupa URL audio yang dapat diakses publik.

---

# Send Document

### Request

```json
{
  "to": "628123456789",
  "type": "document",
  "url": "https://example.com/file.pdf",
  "fileName": "invoice.pdf"
}
```

### Notes

* `url` harus berupa URL file yang dapat diakses publik.
* `fileName` bersifat opsional.

---

# Parameters

| Parameter | Type    | Required | Description                                   |
| --------- | ------- | -------- | --------------------------------------------- |
| to        | string  | Yes      | Nomor tujuan WhatsApp                         |
| type      | string  | Yes      | text, image, video, audio, document           |
| text      | string  | No       | Isi pesan / caption                           |
| url       | string  | Depends  | URL media untuk image, video, audio, document |
| fileName  | string  | No       | Nama file dokumen                             |
| isHeader  | boolean | No       | Mengaktifkan header preview                   |

---

# Example cURL

### Text

```bash
curl -X POST http://localhost:3000/api/send \
-H "x-api-key: YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
  "to":"628123456789",
  "type":"text",
  "text":"Halo"
}'
```

### Image

```bash
curl -X POST http://localhost:3000/api/send \
-H "x-api-key: YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
  "to":"628123456789",
  "type":"image",
  "url":"https://example.com/image.jpg",
  "text":"Caption gambar"
}'
```

### Video

```bash
curl -X POST http://localhost:3000/api/send \
-H "x-api-key: YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
  "to":"628123456789",
  "type":"video",
  "url":"https://example.com/video.mp4",
  "text":"Caption video"
}'
```

### Text + Header

```bash
curl -X POST http://localhost:3000/api/send \
-H "x-api-key: YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
  "to":"628123456789",
  "type":"text",
  "text":"Halo",
  "isHeader":true
}'
```
