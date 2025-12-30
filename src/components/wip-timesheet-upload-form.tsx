'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { Upload, FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WIPTimesheetUploadForm() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [autoFilled, setAutoFilled] = useState<string[]>([])
  const [showWarnings, setShowWarnings] = useState(false)
  const [showAutoFilled, setShowAutoFilled] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploading) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (uploading) return

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      if (droppedFile.type !== 'text/csv' && !droppedFile.name.endsWith('.csv')) {
        setMessage({ type: 'error', text: 'Please select a CSV file' })
        return
      }
      setFile(droppedFile)
      setMessage(null)
    }
  }

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

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/wip-timesheet/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      const warningText = data.warnings?.length ? ` Warning: ${data.warnings.length} records failed to process.` : ''
      const autoFilledText = data.autoFilled?.length ? ` Info: ${data.autoFilled.length} records had staff name auto-filled as "Disbursement".` : ''
      
      setMessage({
        type: 'success',
        text: `Successfully uploaded ${data.insertedCount} records.${warningText}${autoFilledText}`
      })
      
      // Store warnings and auto-filled info separately
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings)
        setShowWarnings(true)
      } else {
        setWarnings([])
        setShowWarnings(false)
      }
      
      if (data.autoFilled && data.autoFilled.length > 0) {
        setAutoFilled(data.autoFilled)
        setShowAutoFilled(true)
      } else {
        setAutoFilled([])
        setShowAutoFilled(false)
      }

      // Reset form
      setFile(null)
      const fileInput = document.getElementById('wip-file-input') as HTMLInputElement
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
      setAutoFilled([])
      setShowAutoFilled(false)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Upload WIP Timesheet CSV</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">CSV File</Label>
              <div 
                onClick={() => document.getElementById('wip-file-input')?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
                  isDragging ? "border-black bg-slate-100 scale-[1.01]" : 
                  file ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                <input
                  id="wip-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                {file ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Click to change file</p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-slate-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">Click to select WIP CSV file</p>
                      <p className="text-xs text-slate-500 mt-1">or drag and drop here</p>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-2">
                Required columns: Job Manager, Client Group(s), Client, Account Manager, Staff, Date, Job No., Name, Time, Billable Rate, Billable Amount, Billed?, Note
              </p>
            </div>

            {message && (
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-2 rounded-lg border p-4 ${
                    message.type === 'success'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                      : 'border-destructive/50 bg-destructive/10 text-destructive'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  <p className="text-xs flex-1 font-medium">{message.text}</p>
                  {(warnings.length > 0 || autoFilled.length > 0) && (
                    <div className="flex gap-2">
                      {warnings.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowWarnings(!showWarnings)}
                          className="text-xs font-bold underline hover:no-underline"
                        >
                          {showWarnings ? (
                            <div className="flex items-center gap-1">
                              <ChevronUp className="h-3 w-3" /> Hide errors
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" /> Show errors
                            </div>
                          )}
                        </button>
                      )}
                      {autoFilled.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAutoFilled(!showAutoFilled)}
                          className="text-xs font-bold underline hover:no-underline"
                        >
                          {showAutoFilled ? (
                            <div className="flex items-center gap-1">
                              <ChevronUp className="h-3 w-3" /> Hide auto-filled
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" /> Show auto-filled
                            </div>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {showWarnings && warnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 max-h-64 overflow-y-auto">
                    <h4 className="text-xs font-bold mb-2 text-yellow-700">
                      Failed Records ({warnings.length}):
                    </h4>
                    <ul className="space-y-1 text-[10px] text-yellow-800 font-mono">
                      {warnings.slice(0, 50).map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                      {warnings.length > 50 && (
                        <li className="text-yellow-600 italic font-sans">
                          ... and {warnings.length - 50} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {showAutoFilled && autoFilled.length > 0 && (
                  <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 max-h-64 overflow-y-auto">
                    <h4 className="text-xs font-bold mb-2 text-blue-700">
                      Auto-filled Records ({autoFilled.length}):
                    </h4>
                    <p className="text-[10px] text-blue-600 mb-2">
                      Successfully uploaded with staff set to &quot;Disbursement&quot;
                    </p>
                    <ul className="space-y-1 text-[10px] text-blue-800 font-mono">
                      {autoFilled.slice(0, 50).map((info, index) => (
                        <li key={index}>{info}</li>
                      ))}
                      {autoFilled.length > 50 && (
                        <li className="text-blue-600 italic font-sans">
                          ... and {autoFilled.length - 50} more records
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={uploading || !file}
              size="sm"
              className="bg-black text-white hover:bg-black/80 active:bg-black/70 active:scale-[0.98] transition-all duration-150 h-10 px-8 font-bold text-xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload WIP CSV
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
            <h3 className="text-sm font-semibold text-slate-700">What is WIP Timesheet?</h3>
            <p className="text-xs text-slate-500">
              WIP (Work In Progress) timesheets track work that has been completed but not yet billed. 
              This data is used to generate WIP reports showing unbilled work by client groups, partners, and managers.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">How does data replacement work?</h3>
            <p className="text-xs text-slate-500">
              Each time you upload, the system will first delete ALL existing WIP timesheet data for your organization, then insert the new data from the CSV file.
              This ensures a complete replacement of data with each upload - no duplicates, and the uploaded file becomes the single source of truth.
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
              <li>Job Manager</li>
              <li>Client Group(s)</li>
              <li>Client</li>
              <li>Account Manager</li>
              <li>Staff (required)</li>
              <li>Date (required, format: YYYY-MM-DD or DD-MMM-YYYY)</li>
              <li>Job No.</li>
              <li>Name (Job Name)</li>
              <li>Time (hours)</li>
              <li>Billable Rate (hourly rate)</li>
              <li>Billable Amount (calculated amount)</li>
              <li>Billed? (yes/no)</li>
              <li>Note</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Note: Column names may also include prefixes like [Client], [Ledger], or [Job] (e.g., [Client] Job Manager, [Ledger] Staff).
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

