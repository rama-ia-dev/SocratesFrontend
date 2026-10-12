import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { SectionPublic, SectionYearPublic, UserListItem } from '../types/api';
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

export const Sections: React.FC = () => {
  const { success, error: toastError } = useToast();

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
  const [sectionYears, setSectionYears] = useState<SectionYearPublic[]>([]);
  const [totalSY, setTotalSY] = useState(0);
  const [syOffset, setSyOffset] = useState(0);
  const [syYearFilter, setSyYearFilter] = useState<string>('');
  const [sySectionFilter, setSySectionFilter] = useState<string>('');
  const [loadingSY, setLoadingSY] = useState(true);

  // Diálogo Crear/Modificar Curso Lectivo
  const [isSYModalOpen, setIsSYModalOpen] = useState(false);
  const [editingSY, setEditingSY] = useState<SectionYearPublic | null>(null);
  const [syFormSectionId, setSyFormSectionId] = useState<number | ''>('');
  const [syFormYear, setSyFormYear] = useState<number>(new Date().getFullYear());
  const [syModalError, setSyModalError] = useState<string | null>(null);
  const [savingSY, setSavingSY] = useState(false);

  // Diálogo Asignar Docentes
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetSYForAssign, setTargetSYForAssign] = useState<SectionYearPublic | null>(null);
  const [allProfessors, setAllProfessors] = useState<UserListItem[]>([]);
  const [selectedProfIds, setSelectedProfIds] = useState<number[]>([]);
  const [assignModalError, setAssignModalError] = useState<string | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);

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
      toastError('Error al cargar comisiones');
    } finally {
      setLoadingSections(false);
    }
  }, [sectionSearch, sectionOffset, toastError]);

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
      setSectionYears(res.items);
      setTotalSY(res.total);
    } catch {
      toastError('Error al cargar cursos lectivos');
    } finally {
      setLoadingSY(false);
    }
  }, [syYearFilter, sySectionFilter, syOffset, toastError]);

  // Cargar lista de profesores para asignación
  const fetchProfessors = useCallback(async () => {
    try {
      const res = await api.getUsers({ role: 'professor', limit: 100 });
      setAllProfessors(res.items);
    } catch {
      // Ignorar si no tiene permisos
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    fetchSectionYears();
  }, [fetchSectionYears]);

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
      fetchSectionYears();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setSectionModalError('Ya existe una comisión con ese nombre');
      } else {
        setSectionModalError(err.message || 'Error al guardar la comisión');
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
    setSyFormSectionId(sections[0]?.id_section || '');
    setSyFormYear(new Date().getFullYear());
    setSyModalError(null);
    setIsSYModalOpen(true);
  };

  const handleOpenEditSY = (sy: SectionYearPublic) => {
    setEditingSY(sy);
    setSyFormSectionId(sy.id_section);
    setSyFormYear(sy.year);
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

    setSavingSY(true);
    try {
      if (editingSY) {
        await api.updateSectionYear(editingSY.id_section_year, {
          id_section: Number(syFormSectionId),
          year: syFormYear,
        });
        success('Curso lectivo actualizado');
      } else {
        await api.createSectionYear({
          id_section: Number(syFormSectionId),
          year: syFormYear,
        });
        success('Curso lectivo registrado');
      }
      setIsSYModalOpen(false);
      fetchSectionYears();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setSyModalError('Ya existe ese curso lectivo');
      } else {
        setSyModalError(err.message || 'Error al guardar el curso lectivo');
      }
    } finally {
      setSavingSY(false);
    }
  };

  // ==========================================
  // Handlers Asignar Docentes
  // ==========================================
  const handleOpenAssignModal = (sy: SectionYearPublic) => {
    setTargetSYForAssign(sy);
    const currentAssigned = (sy.assigned_professors || []).map((p) => p.id_professor);
    setSelectedProfIds(currentAssigned);
    setAssignModalError(null);
    setOpenMenuId(null);
    setIsAssignModalOpen(true);
  };

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSYForAssign) return;
    setAssignModalError(null);

    if (selectedProfIds.length === 0) {
      setAssignModalError('Seleccione al menos un docente');
      return;
    }

    setSavingAssign(true);
    try {
      // Registrar cada profesor seleccionado
      for (const profId of selectedProfIds) {
        try {
          await api.createProfessorSectionYear({
            id_professor: profId,
            id_section_year: targetSYForAssign.id_section_year,
          });
        } catch (err: any) {
          // Si ya estaba asignado ignoramos o mostramos advertencia
          if (err.status !== 409) {
            throw err;
          }
        }
      }
      success('Docentes asignados al curso lectivo');
      setIsAssignModalOpen(false);
      fetchSectionYears();
    } catch (err: any) {
      if (err.status === 409) {
        setAssignModalError('El docente ya está asignado a este curso lectivo');
      } else {
        setAssignModalError(err.message || 'Error al asignar docentes');
      }
    } finally {
      setSavingAssign(false);
    }
  };

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

          {loadingSections ? (
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
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
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
                {sections.map((s) => (
                  <option key={s.id_section} value={s.id_section}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loadingSY ? (
            <TableSkeleton rows={4} cols={4} />
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
                          {sy.assigned_professors && sy.assigned_professors.length > 0 ? (
                            sy.assigned_professors.map((p) => (
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
                              <span>Asignar docentes</span>
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
              requiredAsterisk
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
              requiredAsterisk
              value={syFormSectionId}
              onChange={(e) => setSyFormSectionId(Number(e.target.value))}
              disabled={savingSY}
              required
            >
              <option value="" disabled>Seleccione una comisión</option>
              {sections.map((s) => (
                <option key={s.id_section} value={s.id_section}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Input
              label="Año"
              requiredAsterisk
              type="number"
              min={2000}
              max={2100}
              value={syFormYear}
              onChange={(e) => setSyFormYear(Number(e.target.value))}
              disabled={savingSY}
              required
            />
          </div>

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
      {/* Diálogo Asignar Docentes                                 */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Asignar docentes"
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
              Docentes <span className="text-[#B91C1C]">*</span>
            </label>
            <div className="max-h-56 overflow-y-auto border border-[#D6E4F7] rounded-lg divide-y divide-[#D6E4F7] bg-white">
              {allProfessors.map((prof) => {
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
          </div>

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
            >
              Asignar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
