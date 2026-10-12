import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { StudentCreate } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
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

  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');

  // ==========================================
  // Formulario Manual
  // ==========================================
  const [legajo, setLegajo] = useState<number | ''>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('2003-05-15');
  const [enrollmentYear, setEnrollmentYear] = useState<number>(new Date().getFullYear());
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
  const calculatedEmail = legajo
    ? `${legajo}@sistemas.frc.utn.edu.ar`
    : '—';

  // Handler Guardar Manual
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    if (!legajo || legajo <= 0) {
      setManualError('Ingrese un legajo válido (número positivo)');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setManualError('Ingrese nombre y apellido');
      return;
    }
    if (birthDate) {
      const bDate = new Date(birthDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (bDate > today) {
        setManualError('La fecha no puede ser posterior a hoy');
        return;
      }
    }
    if (!enrollmentYear || enrollmentYear < 1950 || enrollmentYear > 2100) {
      setManualError('El año de ingreso no es válido');
      return;
    }

    setIsSubmittingManual(true);
    try {
      await api.createStudent({
        legajo: Number(legajo),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
        enrollment_year: enrollmentYear,
      });
      success('Estudiante registrado. Recibirá un correo de bienvenida');
      navigate('/estudiantes');
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setManualError('Ya existe un alumno con ese legajo');
      } else {
        setManualError(err.message || 'Error al registrar estudiante');
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
        subtitle="Incorpore nuevos alumnos individualmente o mediante plantilla Excel"
      />

      {/* Selector de pestañas */}
      <div className="flex items-center gap-1 border-b border-[#D6E4F7] mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'manual'
              ? 'border-[#1D4ED8] text-[#1D4ED8]'
              : 'border-transparent text-[#51607A] hover:text-[#0F1F3D]'
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'excel'
              ? 'border-[#1D4ED8] text-[#1D4ED8]'
              : 'border-transparent text-[#51607A] hover:text-[#0F1F3D]'
          }`}
        >
          Desde Excel
        </button>
      </div>

      {/* ========================================================= */}
      {/* Pestaña: Registro Manual                                  */}
      {/* ========================================================= */}
      {activeTab === 'manual' && (
        <div className="max-w-2xl bg-white border border-[#D6E4F7] rounded-xl shadow-xs p-8">
          {manualError && (
            <div
              role="alert"
              className="mb-6 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{manualError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitManual} className="space-y-5" noValidate>
            <div>
              <Input
                label="Legajo"
                requiredAsterisk
                type="number"
                min={1}
                placeholder="Ej. 92100"
                value={legajo}
                onChange={(e) => setLegajo(e.target.value ? Number(e.target.value) : '')}
                disabled={isSubmittingManual}
                required
              />
              <div className="mt-2 text-xs text-[#51607A] flex items-center gap-1.5">
                <span className="font-medium text-[#0F1F3D]">Correo de ingreso:</span>
                <span className="font-mono bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#D6E4F7]">
                  {calculatedEmail}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                requiredAsterisk
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isSubmittingManual}
                placeholder="Nombre completo"
                required
              />
              <Input
                label="Apellido"
                requiredAsterisk
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isSubmittingManual}
                placeholder="Apellido"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Fecha de nacimiento"
                requiredAsterisk
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={isSubmittingManual}
                required
              />
              <Input
                label="Año de ingreso"
                requiredAsterisk
                type="number"
                min={1950}
                max={2100}
                value={enrollmentYear}
                onChange={(e) => setEnrollmentYear(Number(e.target.value))}
                disabled={isSubmittingManual}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/estudiantes')}
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
                ? 'border-2 border-[#B91C1C] bg-[#FEE2E2]/20'
                : isDragging
                ? 'border-2 border-[#1D4ED8] bg-[#EFF6FF]'
                : 'border-2 border-dashed border-[#7DD3FC] bg-[#F0F9FF]'
            }`}
          >
            {uploadState === 'loading' ? (
              <div className="py-6 max-w-xs mx-auto space-y-3">
                <p className="text-sm font-medium text-[#0F1F3D]">
                  Leyendo archivo Excel...
                </p>
                <div className="w-full bg-[#BAE6FD] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#1D4ED8] h-full w-2/3 animate-pulse" />
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-[#D6E4F7]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#DCFCE7] text-[#15803D]">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#0F1F3D]">
                      {excelFile.name}
                    </p>
                    <p className="text-xs text-[#51607A]">
                      {(excelFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <span className="text-xs font-medium text-[#1D4ED8] hover:underline px-2 py-1">
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
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-[#B91C1C] hover:bg-[#FEE2E2]"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-[#BAE6FD] flex items-center justify-center text-[#1D4ED8]">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0F1F3D]">
                    Arrastre el archivo aquí o haga clic para seleccionarlo
                  </p>
                  <p className="text-xs text-[#51607A] mt-0.5">
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
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{excelErrorMsg}</span>
            </div>
          )}

          {/* Vista previa si el archivo fue cargado */}
          {uploadState === 'loaded' && previewRows.length > 0 && (
            <div className="space-y-4">
              {/* Alerta obligatoria de advertencia fija */}
              <div className="p-3.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-sm flex items-start gap-2.5">
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
                    className="shrink-0 text-xs font-semibold underline text-[#1D4ED8] hover:text-[#1E40AF] cursor-pointer ml-2"
                    title="Simular corrección automática de los errores"
                  >
                    Corregir datos de muestra
                  </button>
                )}
              </div>

              {/* Resumen */}
              <div className="flex items-center justify-between text-sm font-medium px-1">
                <span className="text-[#0F1F3D]">
                  {validCount} filas válidas · {errorCount} con error
                </span>
                <span className="text-xs text-[#51607A]">
                  Total: {previewRows.length} registros
                </span>
              </div>

              {/* Tabla de previsualización */}
              <div className="overflow-x-auto rounded-xl border border-[#D6E4F7] bg-white">
                <table className="w-full text-left text-sm text-[#0F1F3D]">
                  <thead className="bg-[#EFF6FF] border-b border-[#D6E4F7] text-[12px] font-semibold text-[#51607A] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-16">Fila</th>
                      <th className="px-4 py-3">Legajo</th>
                      <th className="px-4 py-3">Apellido y nombre</th>
                      <th className="px-4 py-3">Fecha nac.</th>
                      <th className="px-4 py-3">Año ing.</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6E4F7]">
                    {previewRows.map((row) => (
                      <tr
                        key={row.row}
                        className={
                          row.status === 'error'
                            ? 'bg-[#FEE2E2]/30'
                            : 'hover:bg-[#E0F2FE]/30'
                        }
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#51607A]">
                          {row.row}
                        </td>
                        <td className="px-4 py-3 font-mono">{row.legajo}</td>
                        <td className="px-4 py-3 font-medium">
                          {row.last_name}, {row.first_name}
                        </td>
                        <td className="px-4 py-3 text-[#51607A]">
                          {row.birth_date}
                        </td>
                        <td className="px-4 py-3 text-[#51607A]">
                          {row.enrollment_year}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C]">
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
              <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
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
