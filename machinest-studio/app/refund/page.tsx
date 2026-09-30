export default function RefundPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', color: '#ddd', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', lineHeight: 1.7 }}>
        <h1 style={{ color: '#fff' }}>Refund & Cancellation Policy</h1>
        <p style={{ color: '#999', fontSize: 13 }}>Last updated: September 2026</p>

        <h3 style={{ color: '#F0801E' }}>1. Subscription Billing</h3>
        <p>Each tool on Machinest Studio is billed on a recurring basis (for example, monthly) at the price shown in the app at the time of purchase. Prices may change over time; any change will apply to future billing cycles only.</p>

        <h3 style={{ color: '#F0801E' }}>2. Cancellation</h3>
        <p>You may cancel any tool's subscription at any time from your account. Upon cancellation, you will continue to have access to that tool until the end of your current billing period. No further charges will be made after cancellation.</p>

        <h3 style={{ color: '#F0801E' }}>3. Refunds</h3>
        <p>Because access is granted immediately upon payment, we do not offer partial or prorated refunds for unused time within a billing period. If you were charged in error or experienced a technical issue that prevented you from using a tool you paid for, contact us and we will review it on a case-by-case basis.</p>

        <h3 style={{ color: '#F0801E' }}>4. Contact for Billing Issues</h3>
        <p>For any billing or refund queries, contact us through the details listed on machinest.in.(+91-7988277215)</p>
      </div>
    </div>
  )
}