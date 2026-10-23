import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  ProfessorSectionYearPublic,
  SectionPublic,
  SectionYearPublic,
  UserListItem,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import {
  Search,
  MoreVertical,
  Plus,
  UserPlus,
  AlertCircle,
  Edit2,
} from 'lucide-react';

// Fila de la pestaña Cursos lectivos: el backend devuelve el curso lectivo solo; los docentes
// asignados y la cantidad de grupos se consultan aparte.
type SectionYearRow = SectionYearPublic & {
  professors: { id_professor: number; first_name: string; last_name: string }[];
  project_count: number;
};

export const Sections: React.FC = () => {
  const { success, error: toastError } = useToast();

  // useToast devuelve funciones nuevas cada vez que aparece o se va un aviso: si las cargas
  // dependieran de toastError, se repetirían con cada aviso. Se usa a través de una referencia.
  const toastErrorRef = useRef(toastError);
  useEffect(() => {
    toastErrorRef.current = toastError;
  }, [toastError]);

  const [activeTab, setActiveTab] = useState<'sections' | 'years'>('sections');

  // ==========================================
  // Pestaña Comisiones
  // ==========================================
  const [sections, setSections] = useState<SectionPublic[]>([]);
  const [totalSections, setTotalSections] = useState(0);
  const [sectionOffset, setSectionOffset] = useState(0);
  const [sectionSearch, setSectionSearch] = useState('');
  const [loadingSections, setLoadingSections] = useState(true);

  // Diálogo Comisión
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionPublic | null>(null);
  const [sectionNameInput, setSectionNameInput] = useState('');
  const [sectionModalError, setSectionModalError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  // ==========================================
  // Pestaña Cursos Lectivos
  // ==========================================
  const [sectionYears, setSectionYears] = useState<SectionYearRow[]>([]);
  const [totalSY, setTotalSY] = useState(0);
  const [syOffset, setSyOffset] = useState(0);
  const [syYearFilter, setSyYearFilter] = useState<string>('');
  const [sySectionFilter, setSySectionFilter] = useState<string>('');
  const [loadingSY, setLoadingSY] = useState(true);
  // Opciones del filtro de año: los años que tienen al menos un curso lectivo, del más reciente
  // al más viejo (se pueden registrar de 2000 a 2100)
  const [yearOptions, setYearOptions] = useState<number[]>([]);

  // Diálogo Crear/Modificar Curso Lectivo
  const [isSYModalOpen, setIsSYModalOpen] = useState(false);
  const [editingSY, setEditingSY] = useState<SectionYearPublic | null>(null);
  const [syFormSectionId, setSyFormSectionId] = useState<number | ''>('');
  const [syFormYear, setSyFormYear] = useState<number>(new Date().getFullYear());
  // Cupo de integrantes de cada equipo del curso lectivo (el backend lo exige al registrarlo)
  const [syFormMin, setSyFormMin] = useState('');
  const [syFormMax, setSyFormMax] = useState('');
  const [syCupoTouched, setSyCupoTouched] = useState(false);
  const [syModalError, setSyModalError] = useState<string | null>(null);
  const [savingSY, setSavingSY] = useState(false);

  const inCupoRange = (v: string) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100;
  const syMinError = !inCupoRange(syFormMin) ? 'Ingrese un número de 1 a 100' : null;
  const syMaxError = !inCupoRange(syFormMax)
    ? 'Ingrese un número de 1 a 100'
    : !syMinError && Number(syFormMax) < Number(syFormMin)
      ? 'No puede ser menor que el mínimo'
      : null;

  // Diálogo Docentes asignados
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetSYForAssign, setTargetSYForAssign] = useState<SectionYearRow | null>(null);
  const [allProfessors, setAllProfessors] = useState<UserListItem[]>([]);
  // Asignaciones actuales del curso lectivo (el id de la asignación hace falta para quitarla)
  const [currentAssignments, setCurrentAssignments] = useState<ProfessorSectionYearPublic[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  // Docentes que quedan asignados al guardar: los actuales que siguen tildados y los nuevos
  const [selectedProfIds, setSelectedProfIds] = useState<number[]>([]);
  const [assignModalError, setAssignModalError] = useState<string | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);

  // Todas las comisiones, para los selectores (la tabla de comisiones está paginada y filtrada)
  const [allSections, setAllSections] = useState<SectionPublic[]>([]);

  // Menú contextual abierto
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Cargar comisiones
  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    try {
      const res = await api.getSections({
        q: sectionSearch || null,
        limit: 10,
        offset: sectionOffset,
      });
      setSections(res.items);
      setTotalSections(res.total);
    } catch {
      toastErrorRef.current('Error al cargar comisiones');
    } finally {
      setLoadingSections(false);
    }
  }, [sectionSearch, sectionOffset]);

  // Cargar cursos lectivos
  const fetchSectionYears = useCallback(async () => {
    setLoadingSY(true);
    try {
      const res = await api.getSectionYears({
        year: syYearFilter ? parseInt(syYearFilter, 10) : null,
        id_section: sySectionFilter ? parseInt(sySectionFilter, 10) : null,
        limit: 10,
        offset: syOffset,
      });
      const rows = await Promise.all(
        res.items.map(async (sy): Promise<SectionYearRow> => {
          const [assignments, projects] = await Promise.all([
            api.getProfessorSectionYears({ id_section_year: sy.id_section_year, limit: 100 }),
            api.getProjects({ id_section_year: sy.id_section_year, limit: 1 }),
          ]);
          return {
            ...sy,
            professors: assignments.items.map((a) => ({
              id_professor: a.id_professor,
              first_name: a.professor_first_name,
              last_name: a.professor_last_name,
            })),
            project_count: projects.total,
          };
        })
      );
      setSectionYears(rows);
      setTotalSY(res.total);
    } catch {
      toastErrorRef.current('Error al cargar cursos lectivos');
    } finally {
      setLoadingSY(false);
    }
  }, [syYearFilter, sySectionFilter, syOffset]);

  // Años con cursos lectivos, recorriendo todas las páginas (el backend devuelve hasta 100)
  const fetchYearOptions = useCallback(async () => {
    try {
      const years = new Set<number>();
      let offset = 0;
      let total = 0;
      do {
        const res = await api.getSectionYears({ limit: 100, offset });
        res.items.forEach((sy) => years.add(sy.year));
        total = res.total;
        offset += 100;
      } while (offset < total);
      setYearOptions([...years].sort((a, b) => b - a));
    } catch {
      toastErrorRef.current('Error al cargar los años de los cursos lectivos');
    }
  }, []);

  // Cargar lista de profesores para asignación
  const fetchProfessors = useCallback(async () => {
    try {
      const res = await api.getUsers({ role: 'professor', limit: 100 });
      setAllProfessors(res.items);
    } catch {
      // Ignorar si no tiene permisos
    }
  }, []);

  const fetchAllSections = useCallback(async () => {
    try {
      const res = await api.getSections({ limit: 100 });
      setAllSections(res.items);
    } catch {
      toastErrorRef.current('Error al cargar comisiones');
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    fetchAllSections();
  }, [fetchAllSections]);

  useEffect(() => {
    fetchSectionYears();
  }, [fetchSectionYears]);

  useEffect(() => {
    fetchYearOptions();
  }, [fetchYearOptions]);

  useEffect(() => {
    fetchProfessors();
  }, [fetchProfessors]);

  // ==========================================
  // Handlers Comisiones
  // ==========================================
  const handleOpenCreateSection = () => {
    setEditingSection(null);
    setSectionNameInput('');
    setSectionModalError(null);
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (sec: SectionPublic) => {
    setEditingSection(sec);
    setSectionNameInput(sec.name);
    setSectionModalError(null);
    setOpenMenuId(null);
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionModalError(null);

    const normName = sectionNameInput.trim().toUpperCase();
    if (!normName) {
      setSectionModalError('Ingrese un nombre');
      return;
    }

    setSavingSection(true);
    try {
      if (editingSection) {
        await api.updateSection(editingSection.id_section, { name: normName });
        success('Comisión actualizada');
      } else {
        await api.createSection({ name: normName });
        success('Comisión registrada');
      }
      setIsSectionModalOpen(false);
      fetchSections();
      fetchAllSections();
      fetchSectionYears();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setSectionModalError('Ya existe una comisión con ese nombre');
      } else if (err.status === 422) {
        // El backend detalla la validación en una lista, en inglés: se muestra la regla en español
        setSectionModalError('El nombre debe tener entre 1 y 20 caracteres');
      } else {
        setSectionModalError('Error al guardar la comisión');
      }
    } finally {
      setSavingSection(false);
    }
  };

  // ==========================================
  // Handlers Cursos Lectivos
  // ==========================================
  const handleOpenCreateSY = () => {
    setEditingSY(null);
    setSyFormSectionId(allSections[0]?.id_section || '');
    setSyFormYear(new Date().getFullYear());
    setSyFormMin('');
    setSyFormMax('');
    setSyCupoTouched(false);
    setSyModalError(null);
    setIsSYModalOpen(true);
  };

  const handleOpenEditSY = (sy: SectionYearPublic) => {
    setEditingSY(sy);
    setSyFormSectionId(sy.id_section);
    setSyFormYear(sy.year);
    setSyFormMin(sy.min_students !== undefined ? String(sy.min_students) : '');
    setSyFormMax(sy.max_students !== undefined ? String(sy.max_students) : '');
    setSyCupoTouched(false);
    setSyModalError(null);
    setOpenMenuId(null);
    setIsSYModalOpen(true);
  };

  const handleSaveSY = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyModalError(null);

    if (!syFormSectionId) {
      setSyModalError('Seleccione una comisión');
      return;
    }
    if (!syFormYear || syFormYear < 2000 || syFormYear > 2100) {
      setSyModalError('El año debe estar entre 2000 y 2100');
      return;
    }
    setSyCupoTouched(true);
    if (syMinError || syMaxError) return;

    setSavingSY(true);
    try {
      if (editingSY) {
        await api.updateSectionYear(editingSY.id_section_year, {
          id_section: Number(syFormSectionId),
          year: syFormYear,
          min_students: Number(syFormMin),
          max_students: Number(syFormMax),
        });
        success('Curso lectivo actualizado');
      } else {
        await api.createSectionYear({
          id_section: Number(syFormSectionId),
          year: syFormYear,
          min_students: Number(syFormMin),
          max_students: Number(syFormMax),
        });
        success('Curso lectivo registrado');
      }
      setIsSYModalOpen(false);
      fetchSectionYears();
      fetchYearOptions();
    } catch (err: any) {
      // El 422 del backend trae una lista de errores, no un texto: no se muestra tal cual
      if (err.status === 409) {
        setSyModalError('Ya existe ese curso lectivo');
      } else {
        setSyModalError('No se pudo guardar el curso lectivo. Revise los datos e intente de nuevo');
      }
    } finally {
      setSavingSY(false);
    }
  };

  // ==========================================
  // Handlers Docentes asignados
  // ==========================================
  const handleOpenAssignModal = async (sy: SectionYearRow) => {
    setTargetSYForAssign(sy);
    setCurrentAssignments([]);
    setSelectedProfIds([]);
    setAssignModalError(null);
    setOpenMenuId(null);
    setIsAssignModalOpen(true);

    // Se consultan las asignaciones al abrir, para no depender de la tabla ya cargada
    setLoadingAssigned(true);
    try {
      const res = await api.getProfessorSectionYears({
        id_section_year: sy.id_section_year,
        limit: 100,
      });
      setCurrentAssignments(res.items);
      setSelectedProfIds(res.items.map((a) => a.id_professor));
    } catch {
      setAssignModalError('No se pudieron cargar los docentes asignados');
    } finally {
      setLoadingAssigned(false);
    }
  };

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSYForAssign) return;
    setAssignModalError(null);

    if (profIdsToAdd.length === 0 && assignmentsToRemove.length === 0) {
      setAssignModalError('No hay cambios para guardar');
      return;
    }

    setSavingAssign(true);
    try {
      for (const assignment of assignmentsToRemove) {
        try {
          await api.deleteProfessorSectionYear(assignment.id_professor_section_year);
        } catch (err: any) {
          // Si otro usuario lo quitó mientras tanto, el resultado buscado ya se cumple
          if (err.status !== 404) {
            throw err;
          }
        }
      }
      for (const profId of profIdsToAdd) {
        try {
          await api.createProfessorSectionYear({
            id_professor: profId,
            id_section_year: targetSYForAssign.id_section_year,
          });
        } catch (err: any) {
          // Si otro usuario lo asignó mientras tanto, el resultado buscado ya se cumple
          if (err.status !== 409) {
            throw err;
          }
        }
      }
      success('Docentes del curso lectivo actualizados');
      setIsAssignModalOpen(false);
      fetchSectionYears();
    } catch (err: any) {
      if (err.status === 404) {
        setAssignModalError('El docente o el curso lectivo ya no existe');
      } else {
        setAssignModalError('Error al guardar los docentes');
      }
      // Los cambios que llegaron a aplicarse antes del error se reflejan en la tabla
      fetchSectionYears();
    } finally {
      setSavingAssign(false);
    }
  };

  const assignedProfIds = currentAssignments.map((a) => a.id_professor);
  const profIdsToAdd = selectedProfIds.filter((id) => !assignedProfIds.includes(id));
  const assignmentsToRemove = currentAssignments.filter(
    (a) => !selectedProfIds.includes(a.id_professor)
  );

  const toggleSelectProfessor = (profId: number) => {
    setSelectedProfIds((prev) =>
      prev.includes(profId) ? prev.filter((id) => id !== profId) : [...prev, profId]
    );
  };

  return (
    <div>
      <PageHeader
        title="Comisiones"
        action={
          activeTab === 'sections' ? (
            <Button
              variant="primary"
              onClick={handleOpenCreateSection}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Registrar comisión
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleOpenCreateSY}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Registrar curso lectivo
            </Button>
          )
        }
      />

      {/* Pestañas de Navegación */}
      <div className="flex items-center gap-1 border-b border-[#D6E4F7] mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'sections'
              ? 'border-[#1D4ED8] text-[#1D4ED8]'
              : 'border-transparent text-[#51607A] hover:text-[#0F1F3D]'
          }`}
        >
          Comisiones
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('years')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'years'
              ? 'border-[#1D4ED8] text-[#1D4ED8]'
              : 'border-transparent text-[#51607A] hover:text-[#0F1F3D]'
          }`}
        >
          Cursos lectivos
        </button>
      </div>

      {/* ========================================================= */}
      {/* Pestaña: Comisiones                                      */}
      {/* ========================================================= */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          {/* Barra de búsqueda */}
          <div className="max-w-md">
            <Input
              type="text"
              placeholder="Buscar por nombre de comisión"
              value={sectionSearch}
              onChange={(e) => {
                setSectionSearch(e.target.value);
                setSectionOffset(0);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Al recargar después de guardar se dejan los datos anteriores hasta que lleguen los nuevos */}
          {loadingSections && sections.length === 0 ? (
            <TableSkeleton rows={4} cols={2} />
          ) : sections.length === 0 ? (
            <EmptyState message="No se encontraron comisiones registradas." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <tbody>
                  {sections.map((sec) => (
                    <TableRow key={sec.id_section}>
                      <TableCell className="font-semibold text-[#0B2A66]">
                        {sec.name}
                      </TableCell>
                      <TableCell className="text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === `sec-${sec.id_section}`
                                ? null
                                : `sec-${sec.id_section}`
                            )
                          }
                          className="p-1 rounded text-[#51607A] hover:text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                          aria-label="Abrir menú de acciones"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === `sec-${sec.id_section}` && (
                          <div className="absolute right-4 top-10 w-36 bg-white border border-[#D6E4F7] rounded-lg shadow-lg py-1 z-20 text-left">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSection(sec)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Modificar</span>
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>

              <Pagination
                total={totalSections}
                limit={10}
                offset={sectionOffset}
                onChangeOffset={setSectionOffset}
              />
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* Pestaña: Cursos lectivos                                 */}
      {/* ========================================================= */}
      {activeTab === 'years' && (
        <div className="space-y-4">
          {/* Filtros Año y Comisión */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Select
                value={syYearFilter}
                onChange={(e) => {
                  setSyYearFilter(e.target.value);
                  setSyOffset(0);
                }}
              >
                <option value="">Todos los años</option>
                {/* El año elegido se mantiene en la lista aunque se quede sin cursos lectivos */}
                {(syYearFilter && !yearOptions.includes(Number(syYearFilter))
                  ? [...yearOptions, Number(syYearFilter)].sort((a, b) => b - a)
                  : yearOptions
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                value={sySectionFilter}
                onChange={(e) => {
                  setSySectionFilter(e.target.value);
                  setSyOffset(0);
                }}
              >
                <option value="">Todas las comisiones</option>
                {allSections.map((s) => (
                  <option key={s.id_section} value={s.id_section}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loadingSY && sectionYears.length === 0 ? (
            <TableSkeleton rows={4} cols={5} />
          ) : sectionYears.length === 0 ? (
            <EmptyState message="No se encontraron cursos lectivos para los filtros seleccionados." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Docentes asignados</TableHead>
                    <TableHead className="w-24 text-center">Grupos</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <tbody>
                  {sectionYears.map((sy) => (
                    <TableRow key={sy.id_section_year}>
                      <TableCell className="font-semibold text-[#0B2A66]">
                        {sy.section_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {sy.year}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {sy.professors.length > 0 ? (
                            sy.professors.map((p) => (
                              <span
                                key={p.id_professor}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#EFF6FF] text-[#1D4ED8] border border-[#BAE6FD]"
                              >
                                {p.first_name} {p.last_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#94A3B8] italic">
                              Sin docentes asignados
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {sy.project_count}
                      </TableCell>
                      <TableCell className="text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === `sy-${sy.id_section_year}`
                                ? null
                                : `sy-${sy.id_section_year}`
                            )
                          }
                          className="p-1 rounded text-[#51607A] hover:text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                          aria-label="Abrir menú de acciones"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === `sy-${sy.id_section_year}` && (
                          <div className="absolute right-4 top-10 w-44 bg-white border border-[#D6E4F7] rounded-lg shadow-lg py-1 z-20 text-left">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSY(sy)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Modificar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(sy)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Docentes asignados</span>
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>

              <Pagination
                total={totalSY}
                limit={10}
                offset={syOffset}
                onChangeOffset={setSyOffset}
              />
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* Diálogo Registrar / Modificar Comisión                   */}
      {/* ========================================================= */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={editingSection ? 'Modificar comisión' : 'Registrar comisión'}
      >
        {sectionModalError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{sectionModalError}</span>
          </div>
        )}

        <form onSubmit={handleSaveSection} className="space-y-4">
          <div>
            <Input
              label="Nombre"
              placeholder="Ej. 3K1"
              maxLength={20}
              value={sectionNameInput}
              onChange={(e) => setSectionNameInput(e.target.value.toUpperCase())}
              disabled={savingSection}
              helperText="Hasta 20 caracteres (se guarda en mayúsculas)"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSectionModalOpen(false)}
              disabled={savingSection}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={savingSection}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* Diálogo Registrar / Modificar Curso Lectivo              */}
      {/* ========================================================= */}
      <Modal
        isOpen={isSYModalOpen}
        onClose={() => setIsSYModalOpen(false)}
        title={editingSY ? 'Modificar curso lectivo' : 'Registrar curso lectivo'}
      >
        {syModalError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{syModalError}</span>
          </div>
        )}

        <form onSubmit={handleSaveSY} className="space-y-4">
          <div>
            <Select
              label="Comisión"
              value={syFormSectionId}
              onChange={(e) => setSyFormSectionId(Number(e.target.value))}
              disabled={savingSY}
              required
            >
              <option value="" disabled>Seleccione una comisión</option>
              {allSections.map((s) => (
                <option key={s.id_section} value={s.id_section}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Input
              label="Año"
              type="number"
              min={2000}
              max={2100}
              value={syFormYear}
              onChange={(e) => setSyFormYear(Number(e.target.value))}
              disabled={savingSY}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mínimo de integrantes"
              inputMode="numeric"
              maxLength={3}
              value={syFormMin}
              onChange={(e) => setSyFormMin(e.target.value.replace(/\D/g, ''))}
              onBlur={() => setSyCupoTouched(true)}
              error={syCupoTouched ? syMinError ?? undefined : undefined}
              disabled={savingSY}
            />
            <Input
              label="Máximo de integrantes"
              inputMode="numeric"
              maxLength={3}
              value={syFormMax}
              onChange={(e) => setSyFormMax(e.target.value.replace(/\D/g, ''))}
              onBlur={() => setSyCupoTouched(true)}
              error={syCupoTouched ? syMaxError ?? undefined : undefined}
              disabled={savingSY}
            />
          </div>
          <p className="text-xs text-[#51607A] -mt-2">
            Vale para todos los equipos de este curso lectivo.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSYModalOpen(false)}
              disabled={savingSY}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={savingSY}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* Diálogo Docentes asignados                               */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Docentes asignados"
        maxWidth="lg"
      >
        {targetSYForAssign && (
          <div className="mb-4 p-3 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-sm flex items-center justify-between text-[#0B2A66]">
            <div>
              <span className="font-semibold">Comisión: </span>
              <span>{targetSYForAssign.section_name}</span>
            </div>
            <div>
              <span className="font-semibold">Año: </span>
              <span>{targetSYForAssign.year}</span>
            </div>
          </div>
        )}

        {assignModalError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{assignModalError}</span>
          </div>
        )}

        <form onSubmit={handleSaveAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F1F3D] mb-2">
              Docentes
            </label>
            {loadingAssigned ? (
              <p className="text-sm text-[#51607A] py-4 text-center">Cargando docentes...</p>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-[#D6E4F7] rounded-lg divide-y divide-[#D6E4F7] bg-white">
                {allProfessors.map((prof) => {
                  const isAssigned = assignedProfIds.includes(prof.id_user);
                  const isSelected = selectedProfIds.includes(prof.id_user);
                  return (
                    <div
                      key={prof.id_user}
                      onClick={() => toggleSelectProfessor(prof.id_user)}
                      className={`flex items-center justify-between px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F5F9FF]'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-[#0F1F3D]">
                          {prof.last_name}, {prof.first_name}
                        </span>
                        <span className="text-xs text-[#51607A] ml-2">
                          Leg. {prof.legajo}
                        </span>
                        {isAssigned && !isSelected && (
                          <span className="text-xs text-[#B91C1C] italic ml-2">Se quita</span>
                        )}
                        {!isAssigned && isSelected && (
                          <span className="text-xs text-[#1D4ED8] italic ml-2">Nuevo</span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // controlado por el div onClick
                        className="rounded border-[#D6E4F7] text-[#1D4ED8] focus:ring-[#BAE6FD] pointer-events-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {assignmentsToRemove.length > 0 && (
            <p className="text-sm text-[#B91C1C]">
              Se quitará a:{' '}
              {assignmentsToRemove
                .map((a) => `${a.professor_last_name}, ${a.professor_first_name}`)
                .join('; ')}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssignModalOpen(false)}
              disabled={savingAssign}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={savingAssign}
              disabled={loadingAssigned}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
