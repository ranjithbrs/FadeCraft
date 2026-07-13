create policy "Users can view their own payments"
  on payments for select
  using (auth.uid() = user_id);

create policy "Service role can insert payments"
  on payments for insert
  with check (true);

create policy "Service role can update payments"
  on payments for update
  using (true);

create index idx_payments_user_id on payments(user_id);
create index idx_payments_appointment_id on payments(appointment_id);
create index idx_payments_razorpay_order_id on payments(razorpay_order_id);