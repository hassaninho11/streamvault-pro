-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_admin_or_owner(auth.uid()));

-- Allow users to view their own roles (needed for useAdminAuth hook)
CREATE POLICY "Users can view own role" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow admins to insert user roles (for role changes)
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (is_admin_or_owner(auth.uid()));

-- Allow admins to update user roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (is_admin_or_owner(auth.uid()));

-- Allow admins to delete user roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (is_admin_or_owner(auth.uid()));

-- Allow users to insert their own entitlements
CREATE POLICY "Users can insert own entitlements"
ON public.entitlements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own entitlements  
CREATE POLICY "Users can update own entitlements"
ON public.entitlements
FOR UPDATE
USING (auth.uid() = user_id);