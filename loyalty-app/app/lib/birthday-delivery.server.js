// Delivery is independent from entitlement: a failed email never consumes a gift.
// Ambiguous acknowledgements require reconciliation rather than duplicate sends.
export async function deliverBirthdayGift({ db, gift, customer, note, render, send, now = () => new Date() }) {
  if (!gift?.id || gift.status !== 'available') return { outcome: 'skipped' };
  const claim = await db.rpc('sofie_take_birthday_email', { p_id: gift.id });
  if (claim.error) return { outcome: 'failed', reason: 'claim_failed' };
  if (!claim.data) return { outcome: 'skipped' };
  let attempted = false;
  try {
    const html = render({ firstName: customer.first_name, egp: gift.egp_value, note, expiresAt: gift.expires_at });
    attempted = true;
    const email = await send({ to: customer.email, subject: 'Your SOFIE birthday gift is waiting', html, idempotencyKey: `birthday-gift/${gift.id}` });
    const status = email.ok ? 'sent' : email.ambiguous ? 'needs_review' : 'pending';
    const update = await db.from('birthday_grants').update({
      email_status: status,
      email_last_error: email.ok ? null : (email.ambiguous ? 'delivery_acknowledgement_unknown' : 'delivery_rejected'),
      ...(email.ok ? { emailed_at: now().toISOString() } : {}),
    }).eq('id', gift.id).eq('email_status', 'sending').select('id');
    if (update.error || update.data?.length !== 1) return { outcome: 'failed', reason: 'delivery_state_write_failed' };
    return email.ok ? { outcome: 'sent' } : { outcome: 'failed', reason: status };
  } catch {
    // Rendering failures are safe to retry. Once a provider call starts, its
    // outcome may be unknown; retain the gift and avoid an automatic resend.
    try {
      await db.from('birthday_grants').update({
        email_status: attempted ? 'needs_review' : 'pending',
        email_last_error: attempted ? 'delivery_acknowledgement_unknown' : 'render_failed',
      }).eq('id', gift.id).eq('email_status', 'sending');
    } catch { /* A stale claim is quarantined by the next claim RPC. */ }
    return { outcome: 'failed', reason: attempted ? 'needs_review' : 'render_failed' };
  }
}
