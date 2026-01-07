import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface GenerateProductivityPDFOptions {
  kpiCardsElement: HTMLElement | null
  monthlyHoursChartElement: HTMLElement | null
  monthlyPercentageChartElement: HTMLElement | null
  date?: string | null
  staff?: string | null
  organizationName?: string
}

export async function generateProductivityPDF({
  kpiCardsElement,
  monthlyHoursChartElement,
  monthlyPercentageChartElement,
  date,
  staff,
  organizationName,
}: GenerateProductivityPDFOptions): Promise<void> {
  if (!kpiCardsElement || !monthlyHoursChartElement || !monthlyPercentageChartElement) {
    throw new Error('Unable to find all required elements')
  }

  // Create landscape PDF
  // A4 landscape dimensions: 297mm x 210mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pdfWidth = pdf.internal.pageSize.getWidth() // 297mm
  const pdfHeight = pdf.internal.pageSize.getHeight() // 210mm
  const margin = 10
  const contentWidth = pdfWidth - 2 * margin // 277mm
  const headerHeight = 20
  const spacing = 8

  try {
    // Add header with title, date, and staff
    // Title on left - improved spacing
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    const titleY = margin + 7
    pdf.text('Productivity', margin, titleY)

    // Organization name (if provided) - on a new line below title with better spacing
    if (organizationName) {
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100)
      pdf.text(organizationName, margin, margin + 18)
    }

    // Format date
    let dateText = ''
    if (date) {
      const dateObj = new Date(date + 'T00:00:00') // Add time to avoid timezone issues
      const day = dateObj.getDate().toString().padStart(2, '0')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames[dateObj.getMonth()]
      const year = dateObj.getFullYear()
      dateText = `${day} ${month} ${year}`
    } else {
      const today = new Date()
      const day = today.getDate().toString().padStart(2, '0')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames[today.getMonth()]
      const year = today.getFullYear()
      dateText = `${day} ${month} ${year}`
    }

    // Date and Staff information on right top corner - improved formatting
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(70, 70, 70)
    
    const staffText = staff ? staff : 'All Staff'
    const dateLabel = `Date: ${dateText}`
    const staffLabel = `Staff: ${staffText}`
    
    // Calculate positions from right edge with better alignment
    const dateLabelWidth = pdf.getTextWidth(dateLabel)
    const staffLabelWidth = pdf.getTextWidth(staffLabel)
    const rightMargin = pdfWidth - margin
    const maxLabelWidth = Math.max(dateLabelWidth, staffLabelWidth)
    
    // Position date and staff on the right, aligned to the same right edge
    pdf.text(dateLabel, rightMargin - maxLabelWidth, margin + 7)
    pdf.text(staffLabel, rightMargin - maxLabelWidth, margin + 18)

    // Reset text color
    pdf.setTextColor(0, 0, 0)

    // Capture KPI cards
    const kpiCanvas = await html2canvas(kpiCardsElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    })
    const kpiImgData = kpiCanvas.toDataURL('image/png')
    const kpiAspectRatio = kpiCanvas.width / kpiCanvas.height
    const kpiDisplayHeight = Math.min(contentWidth / kpiAspectRatio, 45)
    const kpiDisplayWidth = kpiDisplayHeight * kpiAspectRatio

    // Add KPI cards to PDF (centered)
    const kpiX = margin + (contentWidth - kpiDisplayWidth) / 2
    const kpiY = margin + headerHeight + 2
    pdf.addImage(kpiImgData, 'PNG', kpiX, kpiY, kpiDisplayWidth, kpiDisplayHeight)

    // Calculate remaining space for charts
    const remainingHeight = pdfHeight - margin - headerHeight - kpiDisplayHeight - spacing - margin
    const chartHeight = Math.min(remainingHeight / 2 - spacing / 2, 65)

    // Capture Monthly Billable Hours chart
    const hoursCanvas = await html2canvas(monthlyHoursChartElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    })
    const hoursImgData = hoursCanvas.toDataURL('image/png')
    const hoursAspectRatio = hoursCanvas.width / hoursCanvas.height
    
    // Align chart width with KPI cards: use same width and X position
    const hoursDisplayWidth = kpiDisplayWidth
    const hoursDisplayHeight = hoursDisplayWidth / hoursAspectRatio

    // Add Monthly Billable Hours chart - aligned with KPI cards
    const hoursX = kpiX // Same X position as KPI cards
    const hoursY = kpiY + kpiDisplayHeight + spacing
    pdf.addImage(hoursImgData, 'PNG', hoursX, hoursY, hoursDisplayWidth, hoursDisplayHeight)

    // Capture Monthly Billable % chart
    const percentageCanvas = await html2canvas(monthlyPercentageChartElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    })
    const percentageImgData = percentageCanvas.toDataURL('image/png')
    const percentageAspectRatio = percentageCanvas.width / percentageCanvas.height
    
    // Align chart width with KPI cards: use same width and X position
    const percentageDisplayWidth = kpiDisplayWidth
    const percentageDisplayHeight = percentageDisplayWidth / percentageAspectRatio

    // Add Monthly Billable % chart - aligned with KPI cards
    const percentageX = kpiX // Same X position as KPI cards
    const percentageY = hoursY + hoursDisplayHeight + spacing
    pdf.addImage(percentageImgData, 'PNG', percentageX, percentageY, percentageDisplayWidth, percentageDisplayHeight)

    // Generate filename
    const dateStr = date ? date : new Date().toISOString().split('T')[0]
    const staffStr = staff ? staff.replace(/\s+/g, '-') : 'all-staff'
    const filename = `productivity-report-${dateStr}-${staffStr}.pdf`

    // Save PDF
    pdf.save(filename)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF. Please try again.')
  }
}
