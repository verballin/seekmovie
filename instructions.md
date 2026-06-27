# SeekMov - Project Implementation Blueprint

You are an expert full-stack developer agent. Your task is to complete the missing features for **SeekMov**, a movie tracking and social interaction platform built with React, TypeScript, Vite, and Supabase.

---

## 1. Tech Stack & Environment Reference
- **Frontend:** React 18+ (TypeScript template, using `.tsx` files)
- **Styling:** Standard CSS matching a premium dark/neon aesthetic (`#323437` background, `#2c433b` green accents).
- **Backend/Auth:** Supabase JS v2
- **External API:** The Movie Database (TMDB)

---

## 2. Existing Database Schema (Supabase)
The database structure is already deployed. Refer to these exact tables and relationships when writing queries:

### profiles
- `id` (uuid, primary key, references auth.users)
- `username` (text, unique)
- `avatar_url` (text)

### favorites
- `id` (bigint, primary key)
- `user_id` (uuid, references profiles.id)
- `tmdb_movie_id` (text)
- `title` (text)
- `poster_path` (text)

### posts
- `id` (bigint, primary key)
- `user_id` (uuid, references profiles.id)
- `content` (text)
- `created_at` (timestamp)

### post_reactions
- `id` (bigint, primary key)
- `post_id` (bigint, references posts.id)
- `user_id` (uuid, references profiles.id)
- `is_like` (boolean: true = upvote, false = dislike)
- Unique constraint on `(post_id, user_id)`

### replies
- `id` (bigint, primary key)
- `post_id` (bigint, references posts.id)
- `user_id` (uuid, references profiles.id)
- `content` (text)
- `created_at` (timestamp)

---

## 3. Scope of Work Required

### Task A: Navigation & App State (`src/App.tsx`)
1. Implement a state variable (`view`) to toggle between `'dashboard'` and `'community'`.
2. Keep the `Auth` conditional wrapper intact: if `user` is null, render `<Auth />`. If logged in, render the main application layout with a top or sidebar navigation system to switch views.

### Task B: Community Wall Component (`src/pages/Community.tsx` & `src/pages/Community.css`)
Create a fully responsive social interface that performs the following operational actions:

1. **Fetch & Display Posts:** - Pull entries from the `posts` table.
   - Perform a relational join (`.select('*, profiles(username)')`) to display the creator's username beside their post content.
2. **Create New Posts:** - Provide a styled textarea form.
   - Insert new rows into `posts` using the current authenticated `user.id`.
3. **Like / Dislike Mechanics (Reactions):**
   - Query the aggregate counts of `is_like = true` and `is_like = false` for every post.
   - Implement functionality to trigger an `upsert` statement to `post_reactions` when clicked, ensuring single-user constraints.
4. **Nested Replies System:**
   - For every post, query and render associated replies from the `replies` table.
   - Provide a small dropdown or text input under each post allowing users to submit new replies instantly.

---

## 4. UI/UX Specifications
- **Theme Consistency:** Keep text colors highly legible (`#ffffff`), descriptive subtitles muted (`#8a99a8`), and interactive elements cleanly border-highlighted on focus using transitions.
- **TypeScript Strictness:** Explicitly type all state objects, payload arguments, and database return shapes. Do not use `any`.

---
*Ready for generation. Read code assets in `src/` directory and begin implementation.*