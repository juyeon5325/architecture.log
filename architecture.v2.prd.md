# 🏙️ My Architecture Log v2 — Instagram-style Architecture Feed

## 📘 Project Overview
**My Architecture Log v2** is a web-based architecture travel log inspired by Instagram's social feed logic.  
Each user can upload architectural site records (photos, notes, tags, and location),  
and these records appear in a public feed where others can explore, like, and comment.

The design direction avoids Instagram's vivid color palette —  
instead, it follows **Notion's calm, neutral tones (white, beige, light gray)** and uses a **soft, emotional serif or rounded sans-serif font** for a warm, architectural atmosphere.

---

## 🎯 Objectives
- Provide an **emotionally resonant social platform** for architecture students and professionals.  
- Enable users to **share and discover** others' architectural site experiences.  
- Maintain a **minimal, elegant aesthetic** suitable for architectural portfolios.  
- Foster an online community where architecture is experienced through emotion and context, not just data.

---

## 🧱 Core Features
| 기능 | 설명 |
|------|------|
| 🧑‍💻 **User Profiles** | Each user has their own profile with profile picture, bio, and list of uploaded architecture logs. |
| 🏗️ **Feed System (Instagram-like)** | The main page displays all users' public architecture logs chronologically, similar to Instagram's feed. Each post includes image, building name, location, date, note, and tags. |
| 💬 **Comment System** | Users can leave comments on each post. Comments display username, text, and timestamp. (Stored via localStorage in MVP.) |
| ❤️ **Like System** | Users can "like" posts. Likes are counted and visually indicated (filled heart icon). |
| 🏷️ **Category Filter** | Posts can be filtered by building type (Residential, Religious, Cultural, Educational, Public, Commercial, etc.) using a top navigation bar. |
| 🧭 **Explore Tab** | Displays a grid of all posts — acts as an overview/exploration page. Optional keyword search ("빛", "재료", "곡선" etc.). |
| 🔐 **User System (Local Simulation)** | Users can log in locally (username only, no backend auth). Each post is tied to its author ID in localStorage. |
| 📸 **Upload Post** | Users can upload image(s), input building info, notes, tags, and select category. Auto-generated date + author. |
| 🕊️ **Emotion Palette (Optional)** | Each post can include a mood color (user selects one that matches the emotional tone of the space). |
| 💾 **Storage** | All user data (posts, comments, likes) stored in localStorage for MVP; structure designed for later Firebase migration. |

---

## 💻 Technical Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript  
- **Storage:** localStorage (simulated DB for MVP)  
- **Architecture:** Modular JS structure (`user.js`, `post.js`, `feed.js`, `comment.js`)  
- **Future Upgrade:** Firebase Authentication + Firestore Database  

---

## 🧭 User Flow
1. User logs in locally with a nickname.  
2. Home feed loads showing all users' architecture logs (newest first).  
3. User scrolls feed → likes, comments, and explores.  
4. "Add Record" button opens an upload modal (image + info input).  
5. Post appears immediately in feed and user's personal profile.  
6. Top navigation allows switching between tabs:  
   - `Feed` (전체 기록)  
   - `Explore` (모든 사용자)  
   - `My Page` (내 답사 기록)  
   - `Upload` (새 글 추가)

---

## 🧩 Data Structure

### User
```js
{
  id: "uuid",
  username: "juyoun",
  profileImg: "base64_url",
  bio: "공간의 빛을 기록하는 건축학도",
  createdAt: "2024-01-01T00:00:00Z"
}
```

### Post
```js
{
  id: "post_uuid",
  userId: "user_uuid",
  username: "juyoun",
  buildingName: "건물명",
  category: "종교건축",
  location: "서울 종로구",
  date: "2024-01-15",
  photo: "base64_url",
  note: "메모 내용",
  tags: ["빛", "재료", "공간"],
  emotionColor: "#F5E6D3",
  likes: ["user1", "user2"],
  isPublic: true,
  createdAt: "2024-01-15T10:00:00Z"
}
```

### Comment
```js
{
  id: "comment_uuid",
  postId: "post_uuid",
  userId: "user_uuid",
  username: "commenter_name",
  content: "댓글 내용",
  createdAt: "2024-01-15T11:00:00Z"
}
```

### Like
```js
{
  postId: "post_uuid",
  userId: "user_uuid"
}
```

---

## 🎨 UI Design System

### Color Palette (Notion-inspired)
- **Background:** `#FAF9F7` (warm beige-white)
- **Cards/Surfaces:** `#FFFFFF` (white)
- **Text Primary:** `#2F3437` (dark gray)
- **Text Secondary:** `#6F7579` (medium gray)
- **Border/Accent:** `#E8E8E8` (light gray)
- **Accent Colors:** Soft pastels for categories
  - 종교건축: `#E8D5C4` (beige)
  - 주거건축: `#D4E8DC` (sage green)
  - 공공건축: `#D8E3F2` (soft blue)
  - 상업건축: `#F5E6D3` (peach)
  - 문화건축: `#F2D8E8` (lavender)
  - 기타: `#E8E8E8` (light gray)

### Typography
- **Font Family:** 'IBM Plex Sans', 'Pretendard', sans-serif
- **Headings:** Semi-bold, 1.5–2rem
- **Body:** Regular, 0.95rem, line-height 1.6
- **Captions:** Regular, 0.85rem

### Layout
- **Feed:** Single column, centered, max-width: 600px
- **Post Cards:** White cards with subtle shadow, rounded corners (8px)
- **Spacing:** Generous padding (24px) between elements

---

## 🌱 Future Roadmap
- [ ] Firebase Authentication integration
- [ ] Real-time comments and likes via Firestore
- [ ] Image optimization and cloud storage
- [ ] User profile pages with post grid
- [ ] Follow/unfollow system
- [ ] Notification system
- [ ] Map integration for location visualization
- [ ] Dark mode support



