import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { StudentCreate } from '../types/api';
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
  X,
  RefreshCw,
} from 'lucide-react';
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

interface PreviewRow {
  row: number;
  legajo: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  enrollment_year: number;
  status: 'valid' | 'error';
  errorMessage?: string;
}

export const RegisterStudents: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();

  // La carga desde Excel queda oculta hasta que se desarrolle su historia (SCRUM-97): por ahora,
  // solo carga manual.
  const [activeTab] = useState<'manual' | 'excel'>('manual');

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
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [excelErrorMsg, setExcelErrorMsg] = useState<string | null>(null);
  const [isSubmittingExcel, setIsSubmittingExcel] = useState(false);

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
      navigate('/usuarios');
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

  // Simular lectura y parseo de Excel con filas de ejemplo válidas y un error de prueba
  const handleProcessFile = (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setUploadState('error');
      setExcelErrorMsg('Solo se admiten archivos Excel (.xlsx)');
      return;
    }

    setExcelFile(file);
    setUploadState('loading');
    setExcelErrorMsg(null);

    setTimeout(() => {
      // Filas de prueba ilustrativas basadas en las especificaciones del brief:
      // "Las columnas esperadas del archivo son Legajo, Apellido, Nombre, Fecha de nacimiento y Año de ingreso"
      // "Resumen: 18 filas válidas · 2 con error"
      const sampleRows: PreviewRow[] = [
        { row: 1, legajo: 92101, last_name: 'Álvarez', first_name: 'Santiago', birth_date: '2002-04-10', enrollment_year: 2022, status: 'valid' },
        { row: 2, legajo: 92102, last_name: 'Benítez', first_name: 'Camila', birth_date: '2002-09-18', enrollment_year: 2022, status: 'valid' },
        { row: 3, legajo: 92103, last_name: 'Castro', first_name: 'Agustín', birth_date: '2001-12-05', enrollment_year: 2021, status: 'valid' },
        { row: 4, legajo: 92104, last_name: 'Duarte', first_name: 'Lucía', birth_date: '2003-01-22', enrollment_year: 2023, status: 'valid' },
        { row: 5, legajo: 92105, last_name: 'Espíndola', first_name: 'Joaquín', birth_date: '2002-07-30', enrollment_year: 2022, status: 'valid' },
        { row: 6, legajo: 92106, last_name: 'Farias', first_name: 'Mariana', birth_date: '2002-11-14', enrollment_year: 2022, status: 'valid' },
        { row: 7, legajo: 89123, last_name: 'Pérez', first_name: 'Juan Ignacio', birth_date: '2001-04-12', enrollment_year: 2021, status: 'error', errorMessage: 'Legajo ya registrado en el sistema' },
        { row: 8, legajo: 92108, last_name: 'Giménez', first_name: 'Paula', birth_date: '2003-03-09', enrollment_year: 2023, status: 'valid' },
        { row: 9, legajo: 92109, last_name: 'Herrera', first_name: 'Facundo', birth_date: '2002-08-16', enrollment_year: 2022, status: 'valid' },
        { row: 10, legajo: -10, last_name: 'Ibarra', first_name: 'Mateo', birth_date: '2003-06-25', enrollment_year: 2023, status: 'error', errorMessage: 'Legajo inválido (debe ser positivo)' },
      ];

      setPreviewRows(sampleRows);
      setUploadState('loaded');
    }, 700);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setExcelFile(null);
    setPreviewRows([]);
    setUploadState('empty');
    setExcelErrorMsg(null);
  };

  const handleFixSampleData = () => {
    // Corrige los errores en la muestra para permitir probar el envío exitoso
    setPreviewRows((prev) =>
      prev.map((r) =>
        r.status === 'error'
          ? {
              ...r,
              legajo: r.legajo <= 0 ? 92110 : 92111,
              status: 'valid' as const,
              errorMessage: undefined,
            }
          : r
      )
    );
  };

  const handleSubmitExcel = async () => {
    const errorCount = previewRows.filter((r) => r.status === 'error').length;
    if (errorCount > 0) return;

    setIsSubmittingExcel(true);
    try {
      const payloadStudents: StudentCreate[] = previewRows.map((r) => ({
        legajo: r.legajo,
        first_name: r.first_name,
        last_name: r.last_name,
        birth_date: r.birth_date,
        enrollment_year: r.enrollment_year,
      }));

      await api.createStudentsBulk({ students: payloadStudents });
      success(`${payloadStudents.length} estudiantes registrados con éxito`);
      navigate('/estudiantes');
    } catch (err: any) {
      setExcelErrorMsg(err.message || 'Error al procesar el lote de estudiantes');
    } finally {
      setIsSubmittingExcel(false);
    }
  };

  const validCount = previewRows.filter((r) => r.status === 'valid').length;
  const errorCount = previewRows.filter((r) => r.status === 'error').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Registrar estudiantes"
        subtitle="Incorpore un nuevo alumno con sus datos personales y académicos"
      />

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
                onClick={() => navigate('/usuarios')}
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
                  <label className="cursor-pointer">
                    <span className="text-xs font-medium text-primary hover:underline px-2 py-1">
                      Reemplazar
                    </span>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  <Button
                    variant="ghostDanger"
                    size="sm"
                    onClick={handleRemoveFile}
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
                  si una fila tiene error, no se registra ninguna.
                </div>
                {errorCount > 0 && (
                  <button
                    type="button"
                    onClick={handleFixSampleData}
                    className="shrink-0 text-xs font-semibold underline text-primary hover:text-primary-hover cursor-pointer ml-2"
                    title="Simular corrección automática de los errores"
                  >
                    Corregir datos de muestra
                  </button>
                )}
              </div>

              {/* Resumen */}
              <div className="flex items-center justify-between text-sm font-medium px-1">
                <span className="text-ink">
                  {validCount} filas válidas · {errorCount} con error
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
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {previewRows.map((row) => (
                      <tr
                        key={row.row}
                        className={
                          row.status === 'error'
                            ? 'bg-danger-soft/30'
                            : 'hover:bg-tint-strong/30'
                        }
                      >
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                          {row.row}
                        </td>
                        <td className="px-4 py-3 font-mono">{row.legajo}</td>
                        <td className="px-4 py-3 font-medium">
                          {row.last_name}, {row.first_name}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {row.birth_date}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {row.enrollment_year}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Error: {row.errorMessage}
                            </span>
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
                  onClick={() => navigate('/estudiantes')}
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
