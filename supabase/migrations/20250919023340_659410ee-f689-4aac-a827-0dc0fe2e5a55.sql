-- Create model_results table for history tracking
CREATE TABLE public.model_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_id UUID NOT NULL,
  dataset_name TEXT NOT NULL,
  problem_type TEXT NOT NULL,
  problem_subtype TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.model_results ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own model results" 
ON public.model_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own model results" 
ON public.model_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own model results" 
ON public.model_results 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own model results" 
ON public.model_results 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_model_results_updated_at
BEFORE UPDATE ON public.model_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();