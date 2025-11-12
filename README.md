# Communal Networks - Christian Fellowship Network Mapping

A realtime Next.js application for mapping and visualising the network of connections within a Christian Fellowship club on a college campus.

## Features

### Multi-User Collaboration
- Shared Supabase database for persistent storage
- Realtime updates via Supabase Realtime websockets (everyone sees changes instantly)
- Lightweight user identification (no authentication required)

### Data Entry
- **Name**: The person's name
- **Categories**: Select one or more small groups (Freshman Group, Val/Santa's group, etc.) or add your own
- **Mutual Connections**: Select from existing people to show relationships
- Dropdown chips for categories and mutual connections
- Ability to add new categories on the fly
- Single-entry mode or bulk import mode

### Duplicate Detection & Merge
- Automatic fuzzy detection of potential duplicates
- Match suggestions against both connections and known users
- Select which record to keep, merge mutual connections, and delete the rest

### Interactive Network Visualisation
- Category hub nodes connected to a central `UMass InterVarsity` root node
- People orbit their categories; mutual connections draw people-to-people links
- Zoom, pan, and drag nodes to explore
- Tooltips summarise group membership, mutual connections, and contributors

## Getting Started

### 1. Clone & Install
```bash
npm install
```

### 2. Configure Supabase
1. Create a new Supabase project (https://supabase.com/)
2. In the SQL editor, run the following script:
   ```sql
   -- Enable UUID generation
   create extension if not exists "uuid-ossp";

   create table if not exists public.users (
     id uuid primary key default uuid_generate_v4(),
     name text not null,
     created_at timestamptz default now()
   );

   create table if not exists public.connections (
     id uuid primary key default uuid_generate_v4(),
     name text not null,
     category text not null,
     categories text[] default '{}',
     mutual_connections text[] default '{}',
     user_id uuid references public.users(id) on delete set null,
     user_name text not null,
     created_at timestamptz default now()
   );

   -- Ensure existing rows have categories populated
   update public.connections
   set categories = array[category]
   where array_length(categories, 1) is null or array_length(categories, 1) = 0;

   -- Enable realtime on these tables
   alter publication supabase_realtime add table public.users;
   alter publication supabase_realtime add table public.connections;
   ```
3. In **Project Settings → API**, note the `Project URL` and `anon` key
4. In the root of this project, create `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
```bash
npm run build
npm start
```

## Usage

### Selecting a User
1. Choose an existing user from the dropdown or create a new one
2. The selected user is stored locally (per-browser) so they are pre-selected next time

### Adding Connections
- Enter the person's name, select (or add) their category
- Optionally choose mutual connections
- Submit the form to push the entry to Supabase

### Bulk Import
- Switch to “Bulk Add”
- Paste names (one per line or comma separated)
- Choose shared category/mutual connections and submit

### Reviewing Duplicates
- Watch the “Possible Duplicates” panel for suggestions
- Select which connection to keep and click **Merge Selected Connections**
- The chosen record retains all mutual connections and removes the duplicates

### Network Map
- Go to “View Network Map” to see the graph
- Drag the canvas to pan, scroll to zoom, and drag individual nodes to reposition
- Category hubs connect to the `UMass InterVarsity` root and the contributing user

## Data Storage & Realtime
- All data is persisted in Supabase tables (`users`, `connections`)
- Supabase Realtime broadcasts inserts/updates/deletes to every connected client
- Local storage is used only to remember the currently selected user per browser

## Technology Stack
- **Next.js 14** – App Router
- **TypeScript**
- **Supabase** – Database + Realtime
- **D3.js** – Custom force-directed graph
- **Fuse.js** – Duplicate detection

## Project Structure
```
├── app/
│   ├── page.tsx              # Main data entry UI
│   ├── network/page.tsx      # Network visualisation
│   ├── layout.tsx            # Root layout
│   └── globals.css
├── components/
│   ├── UserSelector.tsx
│   ├── DuplicateSuggestions.tsx
│   └── D3NetworkGraph.tsx
├── lib/
│   ├── supabaseClient.ts     # Supabase client
│   ├── storage.ts            # Supabase data helpers + local user cache
│   ├── duplicates.ts         # Duplicate detection logic
│   ├── network.ts            # Graph-building helpers
│   └── types.ts
└── README.md
```

## License
MIT
