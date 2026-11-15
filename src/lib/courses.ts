// Cursos lectivos de un alumno, como los devuelve el backend

export const courseLabel = (c: { section_name: string; year: number }) => `${c.section_name} (${c.year})`;

type CourseRow = { id_section_year: number; year: number; section_name: string; state: string };

// El backend guarda la inscripción (registered) y la cursada (attending, finished_*) como filas
// separadas del mismo curso lectivo. Se muestra un renglón por curso, con la cursada si la hay,
// del más nuevo al más viejo.
export const byCourse = <T extends CourseRow>(rows: T[]): T[] => {
  const map = new Map<number, T>();
  for (const r of rows) {
    const prev = map.get(r.id_section_year);
    if (!prev || prev.state === 'registered') map.set(r.id_section_year, r);
  }
  return [...map.values()].sort(
    (a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es')
  );
};
