import type { DeliveryComment } from '../types/api';

/**
 * Documentos de cada devolución y notas finales de la planilla de la cátedra.
 *
 * - El documento al que se refiere una devolución viaja como prefijo del texto del comentario
 *   ("[Estudio Inicial] …") y la pantalla lo separa al mostrarlo. Los tres documentos son fijos.
 * - Las notas finales se guardan, por ahora, solo en el navegador (localStorage), hasta que el
 *   backend las guarde.
 */

export const DOCUMENTS = ['Estudio Inicial', 'Definición del producto', 'Planificación y seguimiento'] as const;
export type DocumentName = (typeof DOCUMENTS)[number];

// Nombre corto para la tarjeta de la planilla; el detalle usa el nombre completo
export const DOCUMENT_SHORT: Record<DocumentName, string> = {
  'Estudio Inicial': 'Estudio Inicial',
  'Definición del producto': 'Definición',
  'Planificación y seguimiento': 'Planificación',
};

const PREFIX = /^\[(Estudio Inicial|Definición del producto|Planificación y seguimiento)\]\s*/;

/** Separa el documento del texto de un comentario. */
export const splitComment = (content: string): { document: DocumentName | null; text: string } => {
  const m = PREFIX.exec(content);
  return m ? { document: m[1] as DocumentName, text: content.slice(m[0].length) } : { document: null, text: content };
};

export const withDocument = (document: DocumentName | '', text: string) => (document ? `[${document}] ${text}` : text);

export type DocumentState = 'pending' | 'corrected' | 'none';

export const DOCUMENT_STATE_LABEL: Record<DocumentState, string> = {
  pending: 'Con devolución',
  corrected: 'Corregido',
  none: 'Sin devolución',
};

/**
 * Estado de cada documento en una entrega, a partir de sus devoluciones: con alguna pendiente,
 * "Con devolución"; con todas corregidas, "Corregido"; sin devoluciones, "Sin devolución".
 * Las anotaciones internas no cuentan.
 */
export const documentStates = (comments: DeliveryComment[]): Record<DocumentName, DocumentState> => {
  const states = Object.fromEntries(DOCUMENTS.map((d) => [d, 'none'])) as Record<DocumentName, DocumentState>;
  for (const c of comments) {
    if (c.kind !== 'feedback') continue;
    const { document } = splitComment(c.content);
    if (!document) continue;
    if (c.status.code === 'requested') states[document] = 'pending';
    else if (states[document] === 'none') states[document] = 'corrected';
  }
  return states;
};

// ---- Notas finales (solo en este navegador) ----

// La nota de las entregas es del equipo; la de regularización y la del examen, de cada alumno
export interface StudentFinals {
  regularization: string;
  exam: string;
}

export interface FinalGrades {
  deliveries: string;
  students: Record<number, StudentFinals>;
}

export const EMPTY_FINALS: FinalGrades = { deliveries: '', students: {} };
export const EMPTY_STUDENT: StudentFinals = { regularization: '', exam: '' };

const finalsKey = (id_project: number) => `entregas-vista-previa-notas-${id_project}`;

export const readFinals = (id_project: number): FinalGrades => {
  try {
    const raw = localStorage.getItem(finalsKey(id_project));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? { deliveries: parsed.deliveries ?? '', students: parsed.students ?? {} } : EMPTY_FINALS;
  } catch {
    return EMPTY_FINALS;
  }
};

export const saveFinals = (id_project: number, finals: FinalGrades) => {
  try {
    localStorage.setItem(finalsKey(id_project), JSON.stringify(finals));
  } catch {
    // Sin almacenamiento disponible: la nota queda solo en pantalla
  }
};
