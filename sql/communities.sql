-- Communities Tables

-- Create communities table
CREATE TABLE public.communities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read communities
CREATE POLICY "Anyone can read communities"
    ON public.communities FOR SELECT
    USING (true);

-- Allow authenticated users to insert communities
CREATE POLICY "Users can create communities"
    ON public.communities FOR INSERT
    WITH CHECK (auth.uid() = creator_id);


-- Create community_members table
CREATE TABLE public.community_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(community_id, user_id)
);

-- Enable RLS
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Allow all users to read members
CREATE POLICY "Anyone can read community members"
    ON public.community_members FOR SELECT
    USING (true);

-- Allow users to join communities
CREATE POLICY "Users can join communities"
    ON public.community_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- Create community_messages table
CREATE TABLE public.community_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Allow all users to read messages
CREATE POLICY "Anyone can read community messages"
    ON public.community_messages FOR SELECT
    USING (true);

-- Allow users to insert messages
CREATE POLICY "Users can insert community messages"
    ON public.community_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);
