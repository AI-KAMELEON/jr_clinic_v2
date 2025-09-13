-- Add missing columns to pacjenci table
ALTER TABLE public.pacjenci 
ADD COLUMN adres TEXT,
ADD COLUMN data_urodzenia DATE,
ADD COLUMN email TEXT;

