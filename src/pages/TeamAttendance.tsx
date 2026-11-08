import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SearchX, ClipboardCheck, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { useAuth } from '../context/AuthContext';
import {
  ProfessorSectionYearPublic,
  ProjectAttendanceMember,
  ProjectPublic,
  SectionYearPublic,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { DateField } from '../components/ui/DateField';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';

// Por debajo de este porcentaje la asistencia de un integrante se marca como baja
const LOW_ATTENDANCE = 80;

interface Course {
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
}

interface TeamAttendance {
  project: ProjectPublic;
  members: ProjectAttendanceMember[];
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Primera comisión (por nombre) de un año
const firstCourseOf = (list: Course[], year: number): number | null =>
  list
    .filter((c) => c.year === year)
    .sort((a, b) => a.section_name.localeCompare(b.section_name, 'es'))[0]?.id_section_year ?? null;

const teamLabel =(p: ProjectPublic) => `Equipo ${p.group_number}${p.name ? ` · ${p.name}` : ''}`;

const percentageOf = (m: ProjectAttendanceMember): number | null => m.attendance?.attendance_percentage ?? null;

const isLow = (m: ProjectAttendanceMember) => {
  const pct = percentageOf(m);
  return pct !== null && pct < LOW_ATTENDANCE;
};

const formatPct = (pct: number) =>
  `${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

/** Barra y porcentaje de asistencia: rojo por debajo del 80 %, verde desde el 80 %. */
const AttendanceBar: React.FC<{ member: ProjectAttendanceMember }> = ({ member }) => {
  const pct = percentageOf(member);
  if (pct === null) return <span className="text-xs text-ink-faint">Sin clases con asistencia</span>;
  const low = pct < LOW_ATTENDANCE;
  return (
    <div className="flex items-center gap-2 min-w-32">
      <div
        className="h-2 flex-1 rounded-full bg-line-neutral overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Asistencia de ${member.first_name} ${member.last_name}`}
      >
        <div className={`h-full ${low ? 'bg-danger-vivid' : 'bg-success-vivid'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums w-14 text-right ${low ? 'text-danger' : 'text-success'}`}>
        {formatPct(pct)}
      </span>
    </div>
  );
};

export const TeamAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin;
  const currentYear = new Date().getFullYear();

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [coursesError, setCoursesError] = useState(false);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const [teams, setTeams] = useState<TeamAttendance[] | null>(null);
  const [teamsError, setTeamsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Cursos lectivos: el administrador ve todos; el docente, aquellos a los que está asignado
  useEffect(() => {
    if (!user) return;
    setCoursesError(false);
    const load: Promise<Course[]> = isSuperAdmin
      ? fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o }))
      : fetchAll<ProfessorSectionYearPublic>((o) =>
          api.getProfessorSectionYears({ id_professor: user.id_user, limit: 100, offset: o })
        );
    load
      .then((items) => {
        const list = items.map(({ id_section_year, year, id_section, section_name }) => ({
          id_section_year,
          year,
          id_section,
          section_name,
        }));
        setCourses(list);
        // Por defecto, el año en curso; si no tiene cursos lectivos, el más reciente
        const years = list.map((c) => c.year);
        if (years.length > 0) {
          const year = years.includes(currentYear) ? currentYear : Math.max(...years);
          setYearFilter(year);
          setCourseId(firstCourseOf(list, year));
        }
      })
      .catch(() => setCoursesError(true));
  }, [user, isSuperAdmin, currentYear]);

  const yearOptions = useMemo(
    () => [...new Set((courses ?? []).map((c) => c.year))].sort((a, b) => b - a),
    [courses]
  );

  const coursesOfYear = useMemo(
    () =>
      (courses ?? [])
        .filter((c) => c.year === yearFilter)
        .sort((a, b) => a.section_name.localeCompare(b.section_name, 'es')),
    [courses, yearFilter]
  );

  // Al cambiar de año se elige en el mismo paso la primera comisión del año y se limpia el rango de
  // fechas: así nunca queda elegida una comisión de otro año y la pantalla no salta
  const changeYear = (year: number) => {
    setYearFilter(year);
    setCourseId(firstCourseOf(courses ?? [], year));
    setFrom('');
    setTo('');
  };

  // El rango se aplica solo cuando está completo y ordenado
  const rangeError = from && to && from > to ? 'La fecha "Hasta" no puede ser anterior a "Desde".' : null;
  const range = useMemo(
    () => (rangeError ? null : { from: from || undefined, to: to || undefined }),
    [from, to, rangeError]
  );

  // Equipos del curso lectivo con la asistencia de sus integrantes. Una respuesta vieja se descarta.
  // El esqueleto va solo en la primera carga: al cambiar un filtro se siguen viendo los datos
  // anteriores hasta que llegan los nuevos, sin que la pantalla parpadee.
  const requestId = useRef(0);
  useEffect(() => {
    if (!courseId || !range) return;
    const id = ++requestId.current;
    setLoading(true);
    setTeamsError(false);
    fetchAll<ProjectPublic>((o) => api.getProjects({ id_section_year: courseId, limit: 100, offset: o }))
      .then((projects) =>
        Promise.all(
          projects
            .sort((a, b) => a.group_number - b.group_number)
            .map(async (project) => ({
              project,
              members: (await api.getProjectAttendance(project.id_project, range)).items,
            }))
        )
      )
      .then((result) => {
        if (id === requestId.current) setTeams(result);
      })
      .catch(() => {
        if (id === requestId.current) setTeamsError(true);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [courseId, range, reloadKey]);

  const q = normalize(query.trim());

  const visibleTeams = useMemo(() => {
    if (!teams) return [];
    return teams
      .map((t) => {
        const teamMatches = !!q && normalize(teamLabel(t.project)).includes(q);
        const members = t.members.filter(
          (m) =>
            (!onlyLow || isLow(m)) &&
            (!q ||
              teamMatches ||
              normalize(`${m.first_name} ${m.last_name}`).includes(q) ||
              normalize(`${m.last_name} ${m.first_name}`).includes(q) ||
              String(m.legajo).startsWith(q))
        );
        return { ...t, members, hidden: (onlyLow || !!q) && members.length === 0 && !(teamMatches && !onlyLow) };
      })
      .filter((t) => !t.hidden);
  }, [teams, q, onlyLow]);

  // Totales del curso lectivo (sin la búsqueda ni el filtro de asistencia baja)
  const summary = useMemo(() => {
    if (!teams) return null;
    const members = teams.flatMap((t) => t.members);
    const withPct = members.map(percentageOf).filter((p): p is number => p !== null);
    const totalClasses = members.find((m) => m.attendance)?.attendance?.total_classes ?? 0;
    return {
      teams: teams.length,
      totalClasses,
      average: withPct.length > 0 ? withPct.reduce((a, b) => a + b, 0) / withPct.length : null,
      low: members.filter(isLow).length,
    };
  }, [teams]);

  const clearFilters = () => {
    setQuery('');
    setOnlyLow(false);
  };

  if (coursesError) {
    return (
      <div>
        <PageHeader title="Asistencia" />
        <Alert>No se pudieron cargar los cursos lectivos.</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Asistencia"
        subtitle="Asistencia de cada integrante de los equipos de trabajo, sobre las clases con asistencia tomada"
      />

      {courses !== null && courses.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="w-6 h-6" />}
          message={isSuperAdmin ? 'No hay cursos lectivos registrados' : 'No tiene cursos lectivos asignados'}
          description={
            isSuperAdmin
              ? 'Registre un curso lectivo en Comisiones para consultar su asistencia.'
              : 'Cuando lo asignen a un curso lectivo, podrá consultar aquí la asistencia de sus equipos.'
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Filtros: curso lectivo y rango de fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <Select
              label="Año"
              value={yearFilter ?? ''}
              onChange={(e) => changeYear(Number(e.target.value))}
              disabled={courses === null}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              label="Comisión"
              value={courseId ?? ''}
              onChange={(e) => setCourseId(Number(e.target.value))}
              disabled={courses === null}
            >
              {coursesOfYear.map((c) => (
                <option key={c.id_section_year} value={c.id_section_year}>
                  {c.section_name}
                </option>
              ))}
            </Select>
            <DateField
              label="Desde"
              optional
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              min={yearFilter ? `${yearFilter}-01-01` : undefined}
              max={yearFilter ? `${yearFilter}-12-31` : undefined}
            />
            <DateField
              label="Hasta"
              optional
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={yearFilter ? `${yearFilter}-01-01` : undefined}
              max={yearFilter ? `${yearFilter}-12-31` : undefined}
              error={rangeError ?? undefined}
            />
          </div>

          {/* Totales del curso lectivo */}
          {summary && (
            <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-line bg-white divide-line lg:divide-x max-lg:[&>div:nth-child(-n+2)]:border-b max-lg:[&>div:nth-child(odd)]:border-r">
              {[
                { label: 'Equipos', value: summary.teams, alert: false },
                { label: 'Clases con asistencia tomada', value: summary.totalClasses, alert: false },
                {
                  label: 'Promedio del curso',
                  value: summary.average === null ? '—' : formatPct(summary.average),
                  alert: summary.average !== null && summary.average < LOW_ATTENDANCE,
                },
                { label: `Integrantes con menos del ${LOW_ATTENDANCE} %`, value: summary.low, alert: summary.low > 0 },
              ].map((card) => (
                <div key={card.label} className="px-5 py-3.5 border-line">
                  <dt className="text-[13px] text-ink-muted">{card.label}</dt>
                  <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${card.alert ? 'text-danger' : 'text-ink'}`}>
                    {card.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* Búsqueda y asistencia baja */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="sm:w-80">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar alumno, legajo o equipo"
                aria-label="Buscar alumno, legajo o equipo"
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLow}
                onChange={(e) => setOnlyLow(e.target.checked)}
                className="rounded border-line text-primary focus:ring-accent-light"
              />
              Solo integrantes con menos del {LOW_ATTENDANCE} %
            </label>
          </div>

          {teamsError ? (
            <Alert
              action={
                <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                  <RefreshCw className="w-4 h-4" />
                  Reintentar
                </Button>
              }
            >
              No se pudo cargar la asistencia de los equipos.
            </Alert>
          ) : teams === null ? (
            <TableSkeleton rows={4} cols={5} />
          ) : teams.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="w-6 h-6" />}
              message="No hay equipos en este curso lectivo"
              description="La asistencia se muestra por equipo: cuando se creen los equipos del curso lectivo, aparecerán aquí."
            />
          ) : visibleTeams.length === 0 ? (
            <EmptyState
              icon={<SearchX className="w-6 h-6" />}
              message={
                onlyLow && !q
                  ? `Ningún integrante tiene menos del ${LOW_ATTENDANCE} % de asistencia`
                  : 'Ningún alumno ni equipo coincide con la búsqueda'
              }
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <div className="space-y-4" aria-busy={loading}>
              {visibleTeams.map(({ project, members }) => {
                const lowCount = members.filter(isLow).length;
                return (
                  <section key={project.id_project} className="rounded-xl border border-line bg-white overflow-hidden">
                    <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-line">
                      <h2 className="text-[15px] font-semibold text-ink">
                        <Link to={`/equipos/${project.id_project}`} className="hover:text-primary hover:underline">
                          {teamLabel(project)}
                        </Link>
                      </h2>
                      {lowCount > 0 && (
                        <span className="text-xs font-medium text-danger">
                          {lowCount === 1 ? '1 integrante' : `${lowCount} integrantes`} con menos del {LOW_ATTENDANCE} %
                        </span>
                      )}
                    </header>

                    {members.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-ink-muted">El equipo todavía no tiene integrantes.</p>
                    ) : (
                      <>
                        {/* Escritorio: tabla */}
                        <div className="hidden md:block [&>div]:border-0 [&>div]:rounded-none">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Integrante</TableHead>
                                <TableHead>Legajo</TableHead>
                                <TableHead>Presentes</TableHead>
                                <TableHead>Faltas</TableHead>
                                <TableHead>Asistencia</TableHead>
                              </TableRow>
                            </TableHeader>
                            <tbody>
                              {members.map((m) => (
                                <TableRow key={m.id_student_project}>
                                  <TableCell className="font-medium text-ink">
                                    <span className="inline-flex items-center gap-2">
                                      {m.last_name}, {m.first_name}
                                      {m.is_leader && <Badge variant="leader">Jefe</Badge>}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-ink-muted tabular-nums">{m.legajo}</TableCell>
                                  <TableCell className="tabular-nums">
                                    {m.attendance ? `${m.attendance.attended_classes} de ${m.attendance.total_classes}` : '—'}
                                  </TableCell>
                                  <TableCell className="tabular-nums">
                                    {m.attendance ? m.attendance.total_classes - m.attendance.attended_classes : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <AttendanceBar member={m} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </tbody>
                          </Table>
                        </div>

                        {/* Celular: una fila por integrante */}
                        <ul className="md:hidden divide-y divide-line">
                          {members.map((m) => (
                            <li key={m.id_student_project} className="px-5 py-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-ink">
                                  {m.last_name}, {m.first_name}
                                </span>
                                {m.is_leader && <Badge variant="leader">Jefe</Badge>}
                              </div>
                              <p className="text-xs text-ink-muted tabular-nums">
                                Legajo {m.legajo}
                                {m.attendance &&
                                  ` · ${m.attendance.attended_classes} de ${m.attendance.total_classes} clases · ${
                                    m.attendance.total_classes - m.attendance.attended_classes
                                  } faltas`}
                              </p>
                              <AttendanceBar member={m} />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
