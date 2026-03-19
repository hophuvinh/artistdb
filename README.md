# Artist Rolodex Bot

Telegram bot lưu và tìm kiếm artist/designer cho team.

## Setup

### 1. Tạo Telegram Bot
- Nhắn @BotFather → `/newbot` → lấy **Bot Token**

### 2. Tạo Notion Integration
- Vào https://www.notion.so/my-integrations → New integration
- Lấy **Internal Integration Token**

### 3. Tạo Notion Database
Tạo database với các fields sau:

| Field | Type |
|---|---|
| Name | Title |
| Handle | Rich text |
| Link | URL |
| Medium | Multi-select |
| Style | Multi-select |
| Added By | Rich text |

- Share database với integration vừa tạo
- Lấy **Database ID** từ URL: `notion.so/{workspace}/{DATABASE_ID}?v=...`

### 4. Lấy Anthropic API Key
- Vào https://console.anthropic.com → API Keys → lấy key

### 5. Config môi trường
```bash
cp .env.example .env
```

Điền vào `.env`:
```
TELEGRAM_TOKEN=your_telegram_bot_token
NOTION_KEY=your_notion_integration_key
NOTION_DB_ID=your_notion_database_id
ANTHROPIC_KEY=your_anthropic_api_key
```

### 6. Deploy lên Railway
```bash
# Cài Railway CLI
npm install -g @railway/cli

# Login
railway login

# Tạo project mới
railway init

# Set env vars
railway variables set TELEGRAM_TOKEN=...
railway variables set NOTION_KEY=...
railway variables set NOTION_DB_ID=...
railway variables set ANTHROPIC_KEY=...

# Deploy
railway up
```

---

## Cách dùng

### Lưu artist mới
```
[link] n: tên  m: medium, medium  s: style, style
```
- `n:` tên thật — không bắt buộc
- `m:` medium — bắt buộc
- `s:` style — bắt buộc

**Ví dụ:**
```
instagram.com/kuken.dr n: Khang Dương m: illustration s: dark, maximalism, psychedelic
```

### Tìm kiếm
```
/find [từ khoá]
```
Tìm fuzzy + semantic — hỗ trợ tiếng Việt và tiếng Anh.

**Ví dụ:**
```
/find 3D tối
/find maximal illustration
/find khang
```

### Sửa thông tin
```
/edit @handle
```

### Hướng dẫn
```
/help
```
