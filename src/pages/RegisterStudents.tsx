import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { DateField } from '../components/ui/DateField';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Download,
  X,
} from 'lucide-react';
import {
  readStudentsExcel,
  markError,
  ExcelFileError,
  TEMPLATE_URL,
  type ExcelRow,
} from '../lib/studentsExcel';
import {
  useField,
  validateName,
  validateLegajo,
  validateBirthDate,
  validateEnrollmentYear,
  enrollmentYearRange,
  maxBirthDate,
  minBirthDate,
  digitsOnly,
} from '../lib/validation';
import { Alert } from '../components/ui/Alert';

// Traduce los errores por fila que devuelve POST /students/bulk
const bulkRowError = (detail: string) =>
  detail.includes('already exists')
    ? 'Ya hay un alumno registrado con este legajo'
    : detail.includes('Duplicated')
    ? 'Legajo repetido en el archivo'
    : detail;

const RowErrors: React.FC<{ errors: string[]; className?: string }> = ({ errors, className = '' }) => (
  <ul className={`space-y-1 ${className}`}>
    {errors.map((msg) => (
      <li key={msg} className="flex items-start gap-1 text-xs font-semibold text-danger">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
        {msg}
      </li>
    ))}
  </ul>
);

export const RegisterStudents: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();
  const { user } = useAuth();
  // El super administrador ve a los alumnos en Usuarios. El listado del docente común muestra solo
  // alumnos que ya están en un equipo de sus cursos, donde el recién registrado todavía no aparece:
  // después de registrar sigue en el formulario.
  const listPath = user?.is_super_admin ? '/usuarios' : '/estudiantes';

  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');

  // ==========================================
  // Formulario Manual
  // ==========================================
  const legajo = useField('', validateLegajo);
  const firstName = useField('', validateName('nombre'));
  const lastName = useField('', validateName('apellido'));
  const birthDate = useField('', (v) => validateBirthDate(v), { validateOnChange: true });
  const enrollmentYear = useField('', (v) => validateEnrollmentYear(v, birthDate.value));
  // El año de ingreso se habilita recién con una fecha de nacimiento válida: el rango posible depende de ella
  const enrollmentRange = enrollmentYearRange(birthDate.value);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // ==========================================
  // Carga Excel
  // ==========================================
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<'empty' | 'loading' | 'loaded' | 'error'>('empty');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ExcelRow[]>([]);
  const [excelErrorMsg, setExcelErrorMsg] = useState<string | null>(null);
  const [isSubmittingExcel, setIsSubmittingExcel] = useState(false);
  const uploadId = useRef(0);

  // Correo de ingreso calculado
  const calculatedEmail = legajo.value
    ? `${legajo.value}@sistemas.frc.utn.edu.ar`
    : '—';

  // Handler Guardar Manual
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    // Se revisan todos (no se corta en el primero) para marcar cada campo con error a la vez
    const checks = [legajo, firstName, lastName, birthDate, enrollmentYear].map((f) => f.check());
    if (checks.includes(false)) return;

    setIsSubmittingManual(true);
    try {
      await api.createStudent({
        legajo: Number(legajo.value),
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        birth_date: birthDate.value,
        enrollment_year: Number(enrollmentYear.value),
      });
      success('Estudiante registrado. Recibirá un correo de bienvenida');
      if (user?.is_super_admin) navigate(listPath);
      else [legajo, firstName, lastName, birthDate, enrollmentYear].forEach((f) => f.reset());
    } catch (err: any) {
      // POST /students responde el legajo repetido como 422 con la lista de filas ({row, legajo, detail})
      const rows = Array.isArray(err.detail) ? err.detail : err.errors;
      if (Array.isArray(rows) && String(rows[0]?.detail).includes('already exists')) {
        legajo.reject('Ya existe un alumno con ese legajo');
      } else {
        setManualError(Array.isArray(err.detail) ? 'No se pudo registrar el estudiante' : err.message || 'No se pudo registrar el estudiante');
      }
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleProcessFile = async (file: File) => {
    // Si mientras se lee se cancela o se elige otro archivo, el resultado de esta lectura se descarta
    const upload = ++uploadId.current;
    setExcelErrorMsg(null);
    setPreviewRows([]);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setExcelFile(null);
      setUploadState('error');
      setExcelErrorMsg('Solo se admiten archivos Excel (.xlsx)');
      return;
    }

    setExcelFile(file);
    setUploadState('loading');
    try {
      const rows = await readStudentsExcel(file);
      if (upload !== uploadId.current) return;
      setPreviewRows(rows);
      setUploadState('loaded');
    } catch (err) {
      if (upload !== uploadId.current) return;
      setExcelFile(null);
      setUploadState('error');
      setExcelErrorMsg(
        err instanceof ExcelFileError ? err.message : 'No se pudo leer el archivo'
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Se limpia para que se pueda volver a elegir el mismo archivo después de corregirlo
    e.target.value = '';
    if (file) handleProcessFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isSubmittingExcel) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    uploadId.current++;
    setExcelFile(null);
    setPreviewRows([]);
    setUploadState('empty');
    setExcelErrorMsg(null);
  };

  const handleSubmitExcel = async () => {
    if (previewRows.some((r) => !r.student)) return;
    setExcelErrorMsg(null);
    setIsSubmittingExcel(true);
    try {
      const students = previewRows.map((r) => r.student!);
      await api.createStudentsBulk({ students });
      success(
        students.length === 1
          ? '1 estudiante registrado. Recibirá un correo de bienvenida'
          : `${students.length} estudiantes registrados. Recibirán un correo de bienvenida`
      );
      if (user?.is_super_admin) navigate(listPath);
      else handleRemoveFile();
    } catch (err: any) {
      // Errores por fila (legajo ya registrado): la fila del backend es la posición en el lote
      const rowErrors = Array.isArray(err.detail) ? err.detail : err.errors;
      if (err.status === 422 && Array.isArray(rowErrors) && rowErrors[0]?.row) {
        const rows = previewRows.map((r) => ({ ...r, errors: [...r.errors] }));
        for (const e of rowErrors) {
          const target = rows[e.row - 1];
          if (target) markError(target, bulkRowError(String(e.detail)));
        }
        setPreviewRows(rows);
        setExcelErrorMsg('No se registró ningún alumno. Corrija las filas marcadas y vuelva a subir el archivo');
      } else {
        setExcelErrorMsg(err.message || 'Error al registrar los estudiantes');
      }
    } finally {
      setIsSubmittingExcel(false);
    }
  };

  const errorCount = previewRows.filter((r) => !r.student).length;
  const validCount = previewRows.length - errorCount;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Registrar estudiantes"
        subtitle="Incorpore nuevos alumnos individualmente o mediante plantilla Excel"
      />

      {/* Pestañas: el foco se marca solo al navegar con teclado (estilo global) */}
      <div role="tablist" aria-label="Forma de registro" className="flex items-center gap-6 border-b border-line mb-6">
        {(
          [
            ['manual', 'Manual'],
            ['excel', 'Desde Excel'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px py-2.5 text-sm border-b-2 transition-colors duration-150 cursor-pointer ${
              activeTab === tab
                ? 'border-primary text-ink font-semibold'
                : 'border-transparent text-ink-muted font-medium hover:text-ink hover:border-line-neutral-strong'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* Pestaña: Registro Manual                                  */}
      {/* ========================================================= */}
      {activeTab === 'manual' && (
        <div className="max-w-2xl bg-white border border-line rounded-xl shadow-xs p-8">
          {manualError && (
            <Alert className="mb-6">{manualError}</Alert>
          )}

          <form onSubmit={handleSubmitManual} className="space-y-5" noValidate>
            <div>
              <Input
                label="Legajo"
                inputMode="numeric"
                placeholder="Ej. 92100"
                {...legajo.inputProps}
                onChange={(e) => legajo.setValue(digitsOnly(e.target.value))}
                disabled={isSubmittingManual}
              />
              <div className="mt-2 text-xs text-ink-muted flex items-center gap-1.5">
                <span className="font-medium text-ink">Correo de ingreso:</span>
                <span className="font-mono bg-fill-neutral px-2 py-0.5 rounded border border-line">
                  {calculatedEmail}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                {...firstName.inputProps}
                disabled={isSubmittingManual}
                placeholder="Nombre completo"
              />
              <Input
                label="Apellido"
                {...lastName.inputProps}
                disabled={isSubmittingManual}
                placeholder="Apellido"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateField
                label="Fecha de nacimiento"
                min={minBirthDate()}
                max={maxBirthDate()}
                {...birthDate.inputProps}
                disabled={isSubmittingManual}
              />
              <Input
                label="Año de ingreso"
                inputMode="numeric"
                maxLength={4}
                placeholder={enrollmentRange ? `Ej. ${enrollmentRange.max}` : undefined}
                {...enrollmentYear.inputProps}
                onChange={(e) => enrollmentYear.setValue(digitsOnly(e.target.value))}
                disabled={isSubmittingManual || !enrollmentRange}
                helperText={enrollmentRange ? undefined : 'Ingrese una fecha de nacimiento para habilitar este campo'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(listPath)}
                disabled={isSubmittingManual}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingManual}
              >
                Registrar estudiante
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* Pestaña: Desde Excel                                     */}
      {/* ========================================================= */}
      {activeTab === 'excel' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-line rounded-xl p-4">
            <p className="text-sm text-ink-muted">
              Complete la plantilla con las columnas Legajo, Apellido, Nombre, Fecha de nacimiento y
              Año de ingreso. Hasta 500 alumnos por archivo.
            </p>
            <a
              href={TEMPLATE_URL}
              download
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-primary hover:bg-tint"
            >
              <Download className="w-4 h-4" />
              Descargar plantilla
            </a>
          </div>

          {/* Zona de Carga (Drag & Drop) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-xl p-8 text-center transition-all ${
              uploadState === 'error'
                ? 'border-2 border-danger bg-danger-soft/20'
                : isDragging
                ? 'border-2 border-primary bg-tint'
                : 'border-2 border-dashed border-accent bg-tint-soft'
            }`}
          >
            {uploadState === 'loading' ? (
              <div className="py-6 max-w-xs mx-auto space-y-3">
                <p className="text-sm font-medium text-ink">
                  Leyendo archivo Excel...
                </p>
                <div className="w-full bg-accent-light h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-2/3 animate-pulse" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFile}
                >
                  Cancelar
                </Button>
              </div>
            ) : uploadState === 'loaded' && excelFile ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-line">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-success-soft text-success">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-ink">
                      {excelFile.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {(excelFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className={isSubmittingExcel ? 'pointer-events-none opacity-50' : 'cursor-pointer'}>
                    <span className="text-xs font-medium text-primary hover:underline px-2 py-1">
                      Reemplazar
                    </span>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isSubmittingExcel}
                    />
                  </label>
                  <Button
                    variant="ghostDanger"
                    size="sm"
                    onClick={handleRemoveFile}
                    disabled={isSubmittingExcel}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-accent-light flex items-center justify-center text-primary">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">
                    Arrastre el archivo aquí o haga clic para seleccionarlo
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Archivo Excel (.xlsx)
                  </p>
                </div>
                <label className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById('excel-file-input');
                      if (input) input.click();
                    }}
                  >
                    Seleccionar archivo
                  </Button>
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            )}
          </div>

          {excelErrorMsg && (
            <Alert>{excelErrorMsg}</Alert>
          )}

          {/* Vista previa si el archivo fue cargado */}
          {uploadState === 'loaded' && previewRows.length > 0 && (
            <div className="space-y-4">
              {/* Alerta obligatoria de advertencia fija */}
              <div className="p-3.5 rounded-lg bg-warning-soft border border-warning-line text-warning text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold">
                    El registro es de todo o nada:
                  </span>{' '}
                  si una fila tiene error, no se registra ninguna. Corrija el archivo y vuelva a
                  subirlo.
                </div>
              </div>

              {/* Resumen */}
              <div className="flex items-center justify-between text-sm font-medium px-1">
                <span className="text-ink">
                  {validCount} {validCount === 1 ? 'fila válida' : 'filas válidas'} · {errorCount}{' '}
                  con error
                </span>
                <span className="text-xs text-ink-muted">
                  Total: {previewRows.length} registros
                </span>
              </div>

              {/* Tabla de previsualización */}
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="bg-tint border-b border-line text-[12px] font-semibold text-ink-muted uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-16">Fila</th>
                      <th className="px-4 py-3">Legajo</th>
                      <th className="px-4 py-3">Apellido y nombre</th>
                      <th className="px-4 py-3">Fecha nac.</th>
                      <th className="px-4 py-3">Año ing.</th>
                      <th className="px-4 py-3 hidden xl:table-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {previewRows.map((row) => (
                      <tr
                        key={row.row}
                        className={
                          !row.student ? 'bg-danger-soft/30 align-top' : 'hover:bg-tint-strong/30 align-top'
                        }
                      >
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                          {row.row}
                        </td>
                        <td className="px-4 py-3 font-mono">{row.display.legajo || '—'}</td>
                        <td className="px-4 py-3 font-medium min-w-[160px]">
                          {[row.display.last_name, row.display.first_name].filter(Boolean).join(', ') || '—'}
                          {/* Debajo de xl la columna Estado queda fuera de vista: el error va acá */}
                          {!row.student && <RowErrors errors={row.errors} className="xl:hidden mt-1.5" />}
                        </td>
                        <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                          {row.display.birth_date || '—'}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {row.display.enrollment_year || '—'}
                        </td>
                        <td className="px-4 py-3 min-w-[220px] hidden xl:table-cell">
                          {row.student ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Válido
                            </span>
                          ) : (
                            <RowErrors errors={row.errors} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-4 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(listPath)}
                  disabled={isSubmittingExcel}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSubmitExcel}
                  disabled={errorCount > 0 || isSubmittingExcel}
                  isLoading={isSubmittingExcel}
                >
                  Registrar estudiantes
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
