import { countByModule } from '../models/uploadFileModel.js'

const MODULES = [
  { moduleName: 'purchasing-order', label: 'Purchasing Order' },
  { moduleName: 'maintenance-order', label: 'Maintenance Order' },
  { moduleName: 'request-order', label: 'Request Order' },
]

export async function getFileSummary() {
  const rows = await countByModule()
  const counts = new Map(rows.map((row) => [row.module_name, Number(row.file_count)]))
  return {
    totalFiles: rows.reduce((total, row) => total + Number(row.file_count), 0),
    modules: MODULES.map((module) => ({ ...module, fileCount: counts.get(module.moduleName) || 0 })),
  }
}