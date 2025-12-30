'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { Upload, FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

export function TimesheetUploadForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [showWarnings, setShowWarnings] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setMessage({ type: 'error', text: 'Please select a CSV file' })
        return
      }
      setFile(selectedFile)
      setMessage(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file to upload' })
      return
    }

    if (!startDate || !endDate) {
      setMessage({ type: 'error', text: 'Please select a date range' })
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setMessage({ type: 'error', text: 'Invalid date format' })
      return
    }

    if (start > end) {
      setMessage({ type: 'error', text: 'Start date must be before end date' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('startDate', startDate)
      formData.append('endDate', endDate)

      const response = await fetch('/api/timesheet/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setMessage({
        type: 'success',
        text: `Successfully uploaded ${data.insertedCount} records.${data.warnings?.length ? ` Warning: ${data.warnings.length} records failed to process.` : ''}`
      })
      
      // Store warnings for display
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings)
        setShowWarnings(true)
      } else {
        setWarnings([])
        setShowWarnings(false)
      }

      // Reset form
      setFile(null)
      setStartDate('')
      setEndDate('')
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      // Refresh router to update any data displays
      router.refresh()
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Upload failed, please try again'
      })
      setWarnings([])
      setShowWarnings(false)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Upload Timesheet CSV</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-xs font-medium text-slate-600 uppercase tracking-wider">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
                required
                disabled={uploading}
              />
              <p className="text-xs text-slate-500">
                Select the earliest time entry date in the CSV file
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-xs font-medium text-slate-600 uppercase tracking-wider">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
                required
                disabled={uploading}
              />
              <p className="text-xs text-slate-500">
                Select the latest time entry date in the CSV file
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-input" className="text-xs font-medium text-slate-600 uppercase tracking-wider">CSV File</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{file.name}</span>
                    <span className="text-xs">({(file.size / 1024).toFixed(2)} KB)</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                The CSV file should contain the following columns: Client Group(s), Client, Account Manager, Job Manager, Staff, Date, Time, Billable Rate, Billable Amount, Billed?, Billable, Capacity Reducing?, Note
              </p>
            </div>

            {message && (
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-2 rounded-lg border p-4 ${
                    message.type === 'success'
                      ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'border-destructive/50 bg-destructive/10 text-destructive'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  <p className="text-xs flex-1">{message.text}</p>
                  {warnings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowWarnings(!showWarnings)}
                      className="text-sm underline hover:no-underline"
                    >
                      {showWarnings ? (
                        <>
                          <ChevronUp className="inline h-4 w-4 mr-1" />
                          Hide details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="inline h-4 w-4 mr-1" />
                          Show details
                        </>
                      )}
                    </button>
                  )}
                </div>
                {showWarnings && warnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 max-h-64 overflow-y-auto">
                    <h4 className="text-sm font-semibold mb-2 text-yellow-700 dark:text-yellow-400">
                      Failed Records ({warnings.length}):
                    </h4>
                    <ul className="space-y-1 text-xs text-yellow-800 dark:text-yellow-300">
                      {warnings.slice(0, 50).map((warning, index) => (
                        <li key={index} className="font-mono">{warning}</li>
                      ))}
                      {warnings.length > 50 && (
                        <li className="text-yellow-600 dark:text-yellow-400 italic">
                          ... and {warnings.length - 50} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={uploading || !file || !startDate || !endDate}
              size="sm"
              className="bg-black text-white hover:bg-black/80 active:bg-black/70 active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold text-xs"
            >
              {uploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Why upload CSV?</h3>
            <p className="text-xs text-slate-500">
              The XPM API does not provide staff billable rate information, so we cannot calculate billable amounts directly from the API.
              By regularly uploading CSV files exported from XPM, we can obtain complete billing information.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">How to avoid duplicate data?</h3>
            <p className="text-xs text-slate-500">
              Each time you upload, the system will first delete all existing data in the selected date range, then insert new data.
              This ensures no duplicate records while allowing you to re-upload corrected data.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Recommended upload frequency</h3>
            <p className="text-xs text-slate-500">
              We recommend uploading once per week to keep data up to date. You can also upload anytime as needed.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">CSV file format requirements</h3>
            <p className="text-xs text-slate-500">
              The CSV file should contain the following columns (column names must match exactly):
            </p>
            <ul className="list-disc list-inside text-xs text-slate-500 space-y-1 ml-4">
              <li>Client Group(s)</li>
              <li>Client</li>
              <li>Account Manager</li>
              <li>Job Manager</li>
              <li>Staff (required)</li>
              <li>Date (required, format: YYYY-MM-DD or DD/MM/YYYY)</li>
              <li>Time (hours)</li>
              <li>Billable Rate (hourly rate)</li>
              <li>Billable Amount (calculated amount)</li>
              <li>Billed? (yes/no)</li>
              <li>Billable (yes/no)</li>
              <li>Capacity Reducing? (yes/no)</li>
              <li>Note</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

