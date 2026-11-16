import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CommentKind, DeliveryComment, DeliveryPublic, GradeCategory, SectionYearScore } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Badge } from './ui/Badge';
import { Input, fieldClasses } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import {
  DOCUMENTS,
  DOCUMENT_STATE_LABEL,
  documentStates,
  splitComment,
  withDocument,
  type DocumentName,
} from '../lib/deliveryDocs';
import {
  CATEGORY_HELP,
  CATEGORY_LABEL,
  deliveryError,
  formatDateTime,
  formatDue,
  isValidLink,
  latestGrade,
  statusHelp,
  statusVariant,
} from '../lib/deliveries';
import { ExternalLink } from 'lucide-react';

const CATEGORIES: GradeCategory[] = ['activity', 'follow_up'];
const MAX_COMMENT = 2000;

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-sm font-semibold text-ink">{children}</h4>
);

/**
 * Una entrega de un equipo (SCRUM-59 a 61 y 590): el enlace, el estado, las notas y los comentarios.
 * La manejan el docente del curso lectivo y el administrador. `onChanged` recibe la entrega
 * actualizada después de cada cambio; `onCommentsChanged`, la lista de comentarios cada vez que cambia.
 */
export const DeliveryModal: React.FC<{
  delivery: DeliveryPublic;
  onClose: () => void;
  onChanged: (d: DeliveryPublic) => void;
  onCommentsChanged?: (id_delivery: number, comments: DeliveryComment[]) => void;
}> = ({ delivery: initial, onClose, onChanged, onCommentsChanged }) => {
  const { success } = useToast();
  const [delivery, setDelivery] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const team = `Equipo ${delivery.project.group_number}`;
  const code = delivery.status.code;
  const isApproved = code === 'approved';

  const apply = (d: DeliveryPublic) => {
    setDelivery(d);
    onChanged(d);
  };

  const reload = useCallback(async () => {
    try {
      const d = await api.getDelivery(delivery.id_delivery);
      setDelivery(d);
      onChanged(d);
    } catch {
      // El error que motivó la recarga ya está a la vista
    }
  }, [delivery.id_delivery, onChanged]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      const { text, stale } = deliveryError(err);
      setError(text);
      if (stale) await reload();
    } finally {
      setBusy(null);
    }
  };

  // ---- Enlace ----
  const [editingLink, setEditingLink] = useState(!initial.link);
  const [link, setLink] = useState(initial.link ?? '');
  const [linkError, setLinkError] = useState<string | null>(null);

  const saveLink = () => {
    const value = link.trim();
    if (value && !isValidLink(value)) {
      setLinkError('Ingrese una dirección que empiece con http:// o https://');
      return;
    }
    setLinkError(null);
    run('link', async () => {
      const d = await api.updateDeliveryLink(delivery.id_delivery, value || null);
      apply(d);
      setLink(d.link ?? '');
      setEditingLink(!d.link);
      success(value ? 'Se guardó el enlace de la entrega' : 'Se quitó el enlace de la entrega');
    });
  };

  // ---- Estado ----
  const [confirmApprove, setConfirmApprove] = useState(false);
  const linkMissing = Boolean(delivery.activity.link_required) && !delivery.link;

  const changeStatus = (action: 'submit' | 'withdraw' | 'approve' | 'reject', message: string) =>
    run(action, async () => {
      const d = await api.changeDeliveryStatus(delivery.id_delivery, action);
      apply(d);
      setConfirmApprove(false);
      success(message);
    });

  // ---- Notas ----
  const [scores, setScores] = useState<SectionYearScore[] | null>(null);
  const [scoresFailed, setScoresFailed] = useState(false);
  const [picked, setPicked] = useState<Record<GradeCategory, string>>({
    activity: String(latestGrade(initial, 'activity')?.score.id_score ?? ''),
    follow_up: String(latestGrade(initial, 'follow_up')?.score.id_score ?? ''),
  });

  useEffect(() => {
    api
      .getSectionYearScores(delivery.id_section_year)
      .then((items) => setScores([...items].sort((a, b) => b.value - a.value)))
      .catch(() => setScoresFailed(true));
  }, [delivery.id_section_year]);

  const changedCategories = CATEGORIES.filter(
    (c) => picked[c] && picked[c] !== String(latestGrade(delivery, c)?.score.id_score ?? '')
  );

  const saveGrades = () =>
    run('grades', async () => {
      for (const c of changedCategories) {
        await api.gradeDelivery(delivery.id_delivery, c, Number(picked[c]));
      }
      apply(await api.getDelivery(delivery.id_delivery));
      success('Se guardaron las notas de la entrega');
    });

  // ---- Comentarios ----
  const [comments, setComments] = useState<DeliveryComment[] | null>(null);
  const [commentsFailed, setCommentsFailed] = useState(false);
  const [kind, setKind] = useState<CommentKind>('feedback');
  const [doc, setDoc] = useState<DocumentName | ''>('');
  const [content, setContent] = useState('');
  const [contentError, setContentError] = useState<string | null>(null);

  const loadComments = useCallback(() => {
    setCommentsFailed(false);
    api
      .getDeliveryComments(delivery.id_delivery)
      .then(setComments)
      .catch(() => setCommentsFailed(true));
  }, [delivery.id_delivery]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (comments) onCommentsChanged?.(delivery.id_delivery, comments);
  }, [comments, delivery.id_delivery, onCommentsChanged]);

  const addComment = () => {
    const text = content.trim();
    if (!text) {
      setContentError('Escriba el comentario');
      return;
    }
    setContentError(null);
    run('comment', async () => {
      const c = await api.createDeliveryComment(delivery.id_delivery, kind, withDocument(doc, text));
      setComments((prev) => [c, ...(prev ?? [])]);
      setContent('');
      success(kind === 'feedback' ? 'Se registró la devolución para el equipo' : 'Se registró la anotación interna');
    });
  };

  const markCorrected = (c: DeliveryComment) => {
    setBusy(`correct-${c.id_delivery_comment}`);
    setError(null);
    api
      .correctDeliveryComment(c.id_delivery_comment)
      .then((updated) => {
        setComments((prev) => (prev ?? []).map((x) => (x.id_delivery_comment === updated.id_delivery_comment ? updated : x)));
        success('Se marcó la devolución como corregida');
      })
      .catch((err: any) => {
        setError(err?.status === 409 ? 'La devolución ya estaba marcada como corregida.' : deliveryError(err).text);
        loadComments();
      })
      .finally(() => setBusy(null));
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={`${delivery.activity.title} · ${team}`} maxWidth="xl">
      <div className="space-y-5 text-sm text-ink">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Badge variant={statusVariant(code)}>{delivery.status.name}</Badge>
          <span className="text-ink-muted">
            Fecha de entrega: {formatDue(delivery.activity.due_date, delivery.activity.due_time)}
          </span>
          {delivery.project.name && <span className="text-ink-muted">· {delivery.project.name}</span>}
        </div>

        {error && <Alert>{error}</Alert>}

        {/* Enlace (SCRUM-59) */}
        <section className="space-y-2">
          <SectionTitle>Enlace a los documentos</SectionTitle>
          {editingLink ? (
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  aria-label="Enlace a los documentos"
                  placeholder="https://drive.google.com/…"
                  maxLength={1000}
                  value={link}
                  error={linkError ?? undefined}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setLinkError(null);
                  }}
                  helperText={delivery.activity.link_required ? 'Esta entrega pide un enlace para registrarla.' : undefined}
                />
              </div>
              <div className="flex gap-2 shrink-0">
                {delivery.link && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLink(delivery.link ?? '');
                      setLinkError(null);
                      setEditingLink(false);
                    }}
                    disabled={busy !== null}
                  >
                    Cancelar
                  </Button>
                )}
                <Button variant="outline" onClick={saveLink} isLoading={busy === 'link'} disabled={busy !== null && busy !== 'link'}>
                  Guardar enlace
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href={delivery.link!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 min-w-0 text-primary font-medium hover:underline [overflow-wrap:anywhere]"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                {delivery.link}
              </a>
              <button
                type="button"
                onClick={() => setEditingLink(true)}
                disabled={busy !== null}
                className="text-ink-muted font-medium hover:text-ink hover:underline cursor-pointer disabled:cursor-not-allowed"
              >
                Modificar
              </button>
            </div>
          )}
        </section>

        {/* Estado (SCRUM-59, 60 y 61) */}
        <section className="space-y-2 border-t border-line pt-4">
          <SectionTitle>Estado</SectionTitle>
          <p className="text-ink-muted">{statusHelp(code)}</p>
          {(code === 'requested' || code === 'pending_modification') && (
            <div className="space-y-1.5">
              <Button
                onClick={() => changeStatus('submit', `Se registró la entrega del ${team}`)}
                isLoading={busy === 'submit'}
                disabled={linkMissing || (busy !== null && busy !== 'submit')}
              >
                Registrar como entregada
              </Button>
              {linkMissing && <p className="text-xs text-ink-muted">Cargue el enlace para poder registrarla.</p>}
            </div>
          )}
          {code === 'pending_approval' &&
            (confirmApprove ? (
              <Alert
                tone="warning"
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmApprove(false)} disabled={busy !== null}>
                      Volver
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => changeStatus('approve', `Se aprobó la entrega del ${team}`)}
                      isLoading={busy === 'approve'}
                    >
                      Aprobar
                    </Button>
                  </div>
                }
              >
                Aprobar es definitivo: la entrega no vuelve a cambiar de estado y no admite notas nuevas. Cargue las notas antes de aprobarla.
              </Alert>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setConfirmApprove(true)} disabled={busy !== null}>
                  Aprobar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => changeStatus('reject', `Se pidieron modificaciones al ${team}`)}
                  isLoading={busy === 'reject'}
                  disabled={busy !== null && busy !== 'reject'}
                >
                  Pedir modificaciones
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => changeStatus('withdraw', 'La entrega volvió a Solicitada')}
                  isLoading={busy === 'withdraw'}
                  disabled={busy !== null && busy !== 'withdraw'}
                >
                  Volver a Solicitada
                </Button>
              </div>
            ))}
        </section>

        {/* Notas (SCRUM-61) */}
        <section className="space-y-2 border-t border-line pt-4">
          <SectionTitle>Notas</SectionTitle>
          {scoresFailed ? (
            <p className="text-ink-muted">No se pudieron cargar los conceptos para calificar.</p>
          ) : isApproved ? (
            <ul className="space-y-1">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <span className="text-ink-muted">{CATEGORY_LABEL[c]}:</span>{' '}
                  {latestGrade(delivery, c)?.score.name ?? <span className="italic text-ink-subtle">sin nota</span>}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <Select
                    key={c}
                    id={`grade-${c}`}
                    label={CATEGORY_LABEL[c]}
                    helperText={CATEGORY_HELP[c]}
                    value={picked[c]}
                    disabled={scores === null || busy !== null}
                    onChange={(e) => setPicked((p) => ({ ...p, [c]: e.target.value }))}
                    options={[
                      { value: '', label: scores === null ? 'Cargando conceptos…' : 'Sin nota' },
                      ...(scores ?? []).map((s) => ({ value: s.id_score, label: s.name })),
                    ]}
                  />
                ))}
              </div>
              {changedCategories.length > 0 && (
                <Button variant="outline" onClick={saveGrades} isLoading={busy === 'grades'} disabled={busy !== null && busy !== 'grades'}>
                  Guardar notas
                </Button>
              )}
            </>
          )}
        </section>

        {/* Documentos de la entrega (vista previa: el estado sale de las devoluciones que los nombran) */}
        <section className="space-y-2 border-t border-line pt-4">
          <SectionTitle>Documentos</SectionTitle>
          <p className="text-ink-muted">
            Con una devolución pendiente, el documento queda "Con devolución"; cuando todas sus devoluciones se marcan
            como corregidas, queda "Corregido".
          </p>
          {comments === null ? (
            <div className="h-16 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {DOCUMENTS.map((d) => {
                const state = documentStates(comments)[d];
                return (
                  <li key={d} className="flex items-center justify-between gap-3 px-3.5 py-2">
                    <span>{d}</span>
                    {state === 'none' ? (
                      <span className="text-xs text-ink-subtle">{DOCUMENT_STATE_LABEL.none}</span>
                    ) : (
                      <Badge variant={state === 'corrected' ? 'public' : 'protected'}>{DOCUMENT_STATE_LABEL[state]}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Comentarios (SCRUM-590 y devoluciones al equipo) */}
        <section className="space-y-3 border-t border-line pt-4">
          <SectionTitle>Comentarios</SectionTitle>
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                id="comment-document"
                label="Documento"
                value={doc}
                disabled={busy !== null}
                onChange={(e) => setDoc(e.target.value as DocumentName | '')}
                options={[
                  { value: '', label: 'Toda la entrega' },
                  ...DOCUMENTS.map((d) => ({ value: d, label: d })),
                ]}
              />
              <Select
                id="comment-kind"
                label="Tipo"
                value={kind}
                disabled={busy !== null}
                onChange={(e) => setKind(e.target.value as CommentKind)}
                options={[
                  { value: 'feedback', label: 'Devolución para el equipo' },
                  { value: 'annotation', label: 'Anotación interna' },
                ]}
                helperText={
                  kind === 'annotation'
                    ? 'Nota interna de los docentes del curso y el administrador.'
                    : 'Queda pendiente hasta que se marque como corregida.'
                }
              />
            </div>
            <textarea
              aria-label="Comentario"
              rows={3}
              maxLength={MAX_COMMENT}
              value={content}
              disabled={busy !== null}
              onChange={(e) => {
                setContent(e.target.value);
                setContentError(null);
              }}
              className={`${fieldClasses(contentError ?? undefined)} h-auto py-2 resize-y`}
            />
            {contentError && <p className="text-xs font-medium text-danger">{contentError}</p>}
            <Button variant="outline" onClick={addComment} isLoading={busy === 'comment'} disabled={busy !== null && busy !== 'comment'}>
              Agregar comentario
            </Button>
          </div>

          {commentsFailed ? (
            <p className="text-ink-muted">
              No se pudieron cargar los comentarios.{' '}
              <button type="button" onClick={loadComments} className="text-primary font-medium hover:underline cursor-pointer">
                Reintentar
              </button>
            </p>
          ) : comments === null ? (
            <div className="h-16 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
          ) : comments.length === 0 ? (
            <p className="italic text-ink-subtle">Todavía no hay comentarios en esta entrega</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => {
                const { document, text } = splitComment(c.content);
                return (
                <li key={c.id_delivery_comment} className="rounded-lg border border-line px-3.5 py-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    <Badge variant={c.kind === 'annotation' ? 'professor' : 'neutral'}>
                      {c.kind === 'annotation' ? 'Anotación interna' : 'Devolución'}
                    </Badge>
                    <span className="font-medium text-ink">{document ?? 'Toda la entrega'}</span>
                    {c.kind === 'feedback' && <span>· {c.status.name}</span>}
                    <span>
                      · {c.author.first_name} {c.author.last_name} · {formatDateTime(c.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
                  {c.kind === 'feedback' && c.status.code === 'requested' && (
                    <button
                      type="button"
                      onClick={() => markCorrected(c)}
                      disabled={busy !== null}
                      className="text-xs text-primary font-medium hover:underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Marcar como corregida
                    </button>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
};
