-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create datasets table for DataConnect Pro
CREATE TABLE public.datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'error')),
  row_count INTEGER,
  column_count INTEGER,
  data_profile JSONB,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ML models table for ML Studio
CREATE TABLE public.ml_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  problem_type TEXT NOT NULL CHECK (problem_type IN ('classification', 'regression', 'clustering')),
  problem_subtype TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'training', 'completed', 'error', 'deployed')),
  training_progress INTEGER DEFAULT 0,
  results JSONB,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for datasets
CREATE POLICY "Users can view their own datasets" 
ON public.datasets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own datasets" 
ON public.datasets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own datasets" 
ON public.datasets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own datasets" 
ON public.datasets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for ML models
CREATE POLICY "Users can view their own models" 
ON public.ml_models 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own models" 
ON public.ml_models 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own models" 
ON public.ml_models 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own models" 
ON public.ml_models 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for datasets
INSERT INTO storage.buckets (id, name, public) VALUES ('datasets', 'datasets', false);

-- Create storage policies for datasets bucket
CREATE POLICY "Users can view their own dataset files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own dataset files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own dataset files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own dataset files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_datasets_updated_at
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ml_models_updated_at
  BEFORE UPDATE ON public.ml_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();