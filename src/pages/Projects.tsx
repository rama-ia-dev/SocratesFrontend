import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectPrivacy, ProjectPublic, SectionYearPublic } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { PRIVACY_LABEL, STATUS_VARIANT, teamLabel } from '../lib/projects';

const PAGE_SIZE = 10;

// Equipos de trabajo (SCRUM-105). El backend decide qué equipos ve cada usuario según la
// privacidad: los privados solo aparecen para sus integrantes, los docentes del curso y los
// super administradores.
export const Projects: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sectionYears, setSectionYears] = useState<SectionYearPublic[]>([]);
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [privacy, setPrivacy] = useState<ProjectPrivacy | ''>('');

  // Los filtros de año y comisión salen de los cursos lectivos existentes
  useEffect(() => {
    api
      .getSectionYears({ limit: 100 })
      .then((res) => setSectionYears(res.items))
      .catch(() => setSectionYears([]));
  }, []);

  const yearOptions = useMemo(
    () => [...new Set(sectionYears.map((sy) => sy.year))].sort((a, b) => b - a),
    [sectionYears]
  );
  const sectionOptions = useMemo(() => {
    const byId = new Map(sectionYears.map((sy) => [sy.id_section, sy.section_name]));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [sectionYears]);

  const requestId = useRef(0);
  const fetchProjects = useCallback(async () => {
    // Si se cambian los filtros rápido, una respuesta vieja no pisa la nueva
    const current = ++requestId.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await api.getProjects({
        year: year ? Number(year) : null,
        id_section: section ? Number(section) : null,
        privacy: privacy || null,
        limit: PAGE_SIZE,
        offset,
      });
      if (current !== requestId.current) return;
      setProjects(res.items);
      setTotal(res.total);
    } catch {
      if (current !== requestId.current) return;
      setLoadError(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [year, section, privacy, offset]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const changeFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setOffset(0);
  };
  const hasFilters = Boolean(year || section || privacy);

  return (
    <div className="space-y-6">
      <PageHeader title="Equipos de trabajo" subtitle="Equipos de cada comisión y su proyecto" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          aria-label="Año"
          value={year}
          onChange={changeFilter(setYear)}
          options={[
            { value: '', label: 'Todos los años' },
            ...yearOptions.map((y) => ({ value: y, label: String(y) })),
          ]}
        />
        <Select
          aria-label="Comisión"
          value={section}
          onChange={changeFilter(setSection)}
          options={[
            { value: '', label: 'Todas las comisiones' },
            ...sectionOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <Select
          aria-label="Privacidad"
          value={privacy}
          onChange={changeFilter((v) => setPrivacy(v as ProjectPrivacy | ''))}
          options={[
            { value: '', label: 'Todas las privacidades' },
            ...(Object.keys(PRIVACY_LABEL) as ProjectPrivacy[]).map((p) => ({
              value: p,
              label: PRIVACY_LABEL[p],
            })),
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : loadError ? (
        <EmptyState
          message="No se pudieron cargar los equipos de trabajo."
          action={
            <Button variant="outline" size="sm" onClick={fetchProjects}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reintentar
            </Button>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? 'No hay equipos de trabajo para los filtros elegidos.'
              : 'Todavía no hay equipos de trabajo que pueda ver.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setYear('');
                  setSection('');
                  setPrivacy('');
                  setOffset(0);
                }}
              >
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Equipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Nombre del proyecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Privacidad</TableHead>
                <TableHead className="w-16 text-right">Acciones</TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {projects.map((p) => (
                <TableRow key={p.id_project} onClick={() => navigate(`/equipos/${p.id_project}`)}>
                  <TableCell className="font-semibold whitespace-nowrap">{teamLabel(p)}</TableCell>
                  <TableCell>{p.section_name}</TableCell>
                  <TableCell className="font-mono text-[#51607A]">{p.year}</TableCell>
                  <TableCell className="min-w-[200px]">
                    {p.restricted ? (
                      <span className="italic text-[#51607A]">Detalle reservado</span>
                    ) : p.name ? (
                      p.name
                    ) : (
                      <span className="italic text-[#8A9AB5]">Sin nombre todavía</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.status ? (
                      <Badge variant={STATUS_VARIANT[p.status.code] ?? 'neutral'}>{p.status.name}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.privacy}>{PRIVACY_LABEL[p.privacy]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/equipos/${p.id_project}`);
                      }}
                      className="p-1.5 rounded text-[#51607A] hover:text-[#1D4ED8] hover:bg-[#EFF6FF] cursor-pointer"
                      aria-label={`Ver ${teamLabel(p)} de ${p.section_name} ${p.year}`}
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>

          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChangeOffset={setOffset} />
        </>
      )}
    </div>
  );
};
