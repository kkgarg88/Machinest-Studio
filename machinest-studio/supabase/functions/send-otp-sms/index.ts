Deno.serve(async (req) => {
  const payload = await req.json()
  const phone = payload.user.phone
  const otp = payload.sms.otp

  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "authkey": Deno.env.get("MSG91_AUTH_KEY")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: Deno.env.get("MSG91_TEMPLATE_ID"),
      mobile: phone,
      otp: otp,
    }),
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "SMS failed" }), { status: 500 })
  }
  return new Response(JSON.stringify({}), { status: 200 })
})