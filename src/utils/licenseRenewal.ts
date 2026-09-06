export function calculateRenewedDates(startDate: string, expiryDate: string) {
  const previousStart = new Date(`${startDate}T00:00:00`)
  const previousExpiry = new Date(`${expiryDate}T00:00:00`)
  if (Number.isNaN(previousStart.getTime()) || Number.isNaN(previousExpiry.getTime()) || previousExpiry < previousStart) {
    throw new Error('Invalid license dates')
  }

  const renewedStart = previousExpiry
  const renewedExpiry = new Date(previousExpiry)
  renewedExpiry.setFullYear(renewedExpiry.getFullYear() + 1)

  return {
    startDate: renewedStart.toISOString().slice(0, 10),
    expiryDate: renewedExpiry.toISOString().slice(0, 10),
  }
}
