import { useState, type FormEvent } from 'react';
import type { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';
import { isRecentDoctor } from '@/utils';
import { toggleDaySelection } from '@/utils/doctor';

interface DoctorListProps {
  doctors: Doctor[];
  searchTerm: string;
  selectedShiftFilter: string;
  loading: boolean;
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
}

export default function DoctorList({
  doctors,
  searchTerm,
  selectedShiftFilter,
  loading,
  onUpdateShift,
  onUpdateDoctor,
  onDeleteDoctor,
}: DoctorListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Doctor>>({});
  const [saving, setSaving] = useState(false);
  const [locatingId, setLocatingId] = useState<string | null>(null);

  const term = searchTerm.trim().toLocaleLowerCase('pt-BR');
  const filteredDoctors = doctors.filter((doctor) => {
    const searchableText = [
      doctor.descricao,
      doctor.crm,
      doctor.bairro,
      doctor.complemento,
      doctor.endereco,
      doctor.cidade,
      doctor.observacoes,
      doctor.telefone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('pt-BR');
    const shift = doctor.turno || 'Manhã e Tarde';
    const matchesShift =
      selectedShiftFilter === 'ALL' ||
      shift === selectedShiftFilter ||
      shift === 'Manhã e Tarde';

    return searchableText.includes(term) && matchesShift;
  });

  const startEditing = (doctor: Doctor) => {
    setEditingId(doctor.id);
    setEditForm({
      descricao: doctor.descricao || '',
      crm: doctor.crm || '',
      dias_semana: doctor.dias_semana || doctor.dia_semana || '',
      cidade: doctor.cidade || '',
      bairro: doctor.bairro || '',
      endereco: doctor.endereco || '',
      numero: doctor.numero || '',
      complemento: doctor.complemento || '',
      turno: doctor.turno || 'Manhã e Tarde',
      observacoes: doctor.observacoes || '',
      telefone: doctor.telefone || '',
      email: doctor.email || '',
      map_link: doctor.map_link || '',
    });
  };

  const saveEditing = async (event: FormEvent<HTMLFormElement>, doctor: Doctor) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await onUpdateDoctor(
        doctor.id,
        editForm,
        editForm.descricao || doctor.descricao || ''
      );
      if (saved) setEditingId(null);
      else alert('Não foi possível salvar as alterações do médico.');
    } finally {
      setSaving(false);
    }
  };

  const openNavigation = (doctor: Doctor) => {
    const mapLink = doctor.map_link?.trim();
    if (mapLink) {
      window.open(mapLink, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!navigator.geolocation) {
      alert('A geolocalização não é suportada neste dispositivo.');
      return;
    }

    const mapWindow = window.open('about:blank', '_blank');
    if (mapWindow) mapWindow.opener = null;
    setLocatingId(doctor.id);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude;
        const longitude = coords.longitude;
        const capturedMapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

        try {
          const saved = await onUpdateDoctor(
            doctor.id,
            { map_link: capturedMapLink },
            doctor.descricao || ''
          );
          if (!saved) {
            mapWindow?.close();
            alert('Não foi possível salvar as coordenadas do médico.');
            return;
          }

          if (mapWindow) {
            mapWindow.location.replace(capturedMapLink);
          } else {
            alert(`Coordenadas salvas: ${latitude}, ${longitude}`);
          }
        } catch {
          mapWindow?.close();
          alert('Ocorreu um erro ao salvar as coordenadas do médico.');
        } finally {
          setLocatingId(null);
        }
      },
      (error) => {
        mapWindow?.close();
        setLocatingId(null);
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Permita o acesso à localização para capturar as coordenadas.'
            : error.code === error.TIMEOUT
              ? 'A localização demorou demais para responder. Tente novamente.'
              : 'Não foi possível obter sua localização.';
        alert(message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openWhatsApp = (phone?: string) => {
    if (!phone) return;
    const number = phone.replace(/\D/g, '');
    window.open(
      `https://wa.me/${number.startsWith('55') ? number : `55${number}`}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (loading) {
    return <div className="doctor-empty-state">Carregando médicos...</div>;
  }

  if (filteredDoctors.length === 0) {
    return (
      <div className="doctor-empty-state">
        {doctors.length > 0
          ? 'Nenhum médico corresponde aos filtros selecionados.'
          : 'Nenhum médico encontrado.'}
      </div>
    );
  }

  return (
    <div className="doctor-list">
      {filteredDoctors.map((doctor) => {
        const isEditing = editingId === doctor.id;
        const isRecent = isRecentDoctor(doctor.created_at);
        const days = (doctor.dias_semana || doctor.dia_semana || '')
          .toUpperCase()
          .split(',')
          .map((day) => day.trim())
          .filter(Boolean);
        const shift = doctor.turno || 'Manhã e Tarde';

        return (
          <article className="doctor-card" key={doctor.id}>
            {isEditing ? (
              <form className="doctor-edit-form" onSubmit={(event) => saveEditing(event, doctor)}>
                <div className="doctor-edit-heading">
                  <div>
                    <span className="doctor-eyebrow">Cadastro</span>
                    <h2>Editar médico</h2>
                  </div>
                  <button
                    type="button"
                    className="doctor-icon-button"
                    aria-label="Cancelar edição"
                    onClick={() => setEditingId(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="doctor-edit-grid">
                  <label className="doctor-edit-field doctor-edit-field-wide">
                    Nome
                    <input
                      required
                      value={editForm.descricao || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, descricao: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    CRM
                    <input
                      value={editForm.crm || ''}
                      onChange={(event) => setEditForm({ ...editForm, crm: event.target.value })}
                    />
                  </label>
                  <label className="doctor-edit-field">
                    Telefone
                    <input
                      value={editForm.telefone || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, telefone: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    E-mail
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, email: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    Clínica / local
                    <input
                      value={editForm.complemento || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, complemento: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    Turno
                    <select
                      value={editForm.turno || 'Manhã e Tarde'}
                      onChange={(event) =>
                        setEditForm({ ...editForm, turno: event.target.value })
                      }
                    >
                      {OPCOES_TURNO.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="doctor-edit-field">
                    Cidade / estado
                    <input
                      value={editForm.cidade || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, cidade: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    Bairro
                    <input
                      value={editForm.bairro || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, bairro: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    Endereço
                    <input
                      value={editForm.endereco || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, endereco: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field">
                    Número
                    <input
                      value={editForm.numero || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, numero: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field doctor-edit-field-wide">
                    Dias de atendimento
                    <div className="doctor-form-days">
                      {OPCOES_DIAS.map((day) => {
                        const selected = (editForm.dias_semana || '')
                          .toLowerCase()
                          .split(',')
                          .map((value) => value.trim())
                          .includes(day.value);
                        return (
                          <button
                            type="button"
                            key={day.value}
                            className={
                              selected
                                ? 'doctor-form-day doctor-form-day-active'
                                : 'doctor-form-day'
                            }
                            aria-pressed={selected}
                            onClick={() => setEditForm((current) => ({
                              ...current,
                              dias_semana: toggleDaySelection(current.dias_semana, day.value),
                            }))}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                  <label className="doctor-edit-field doctor-edit-field-wide">
                    Link do mapa
                    <input
                      value={editForm.map_link || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, map_link: event.target.value })
                      }
                    />
                  </label>
                  <label className="doctor-edit-field doctor-edit-field-wide">
                    Observações
                    <textarea
                      value={editForm.observacoes || ''}
                      onChange={(event) =>
                        setEditForm({ ...editForm, observacoes: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="doctor-edit-actions">
                  <button
                    type="button"
                    className="doctor-secondary-button"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="doctor-primary-button" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="doctor-card-header">
                  <div className="doctor-avatar" aria-hidden="true">
                    {(doctor.descricao || 'M').trim().charAt(0).toLocaleUpperCase('pt-BR')}
                  </div>
                  <div className="doctor-title">
                    <div className="doctor-name-row">
                      <h2>{doctor.descricao || 'Médico sem nome'}</h2>
                      {isRecent && <span className="doctor-new-badge">Novo</span>}
                    </div>
                    <div className="doctor-meta">
                      {doctor.crm && <span>CRM {doctor.crm}</span>}
                    </div>
                  </div>
                  <div className="doctor-card-actions">
                    <button
                      type="button"
                      className="doctor-secondary-button doctor-edit-button"
                      onClick={() => startEditing(doctor)}
                      aria-label={`Editar ${doctor.descricao || 'médico'}`}
                    >
                      <span aria-hidden="true">✎</span>
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      className="doctor-icon-button doctor-delete-button"
                      onClick={() => {
                        if (window.confirm(`Excluir ${doctor.descricao || 'este médico'}?`)) {
                          onDeleteDoctor(doctor);
                        }
                      }}
                      aria-label={`Excluir ${doctor.descricao || 'médico'}`}
                      title="Excluir médico"
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M4.5 6h11l-.8 10.1a1.5 1.5 0 0 1-1.5 1.4H6.8a1.5 1.5 0 0 1-1.5-1.4L4.5 6Zm2-2h7l1 2h-9l1-2Zm1.7 4v6m3.6-6v6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {days.length > 0 && (
                  <div className="doctor-days">
                    {days.map((day) => (
                      <span className="doctor-day-chip" key={day}>
                        {day}
                      </span>
                    ))}
                  </div>
                )}

                <div className="doctor-location">
                  <span className="doctor-location-icon" aria-hidden="true">⌖</span>
                  <div>
                    {doctor.complemento && (
                      <div className="doctor-clinic">{doctor.complemento}</div>
                    )}
                    {(doctor.endereco || doctor.numero) && (
                      <div className="doctor-address">
                        {[doctor.endereco, doctor.numero].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <div className="doctor-locality">
                      {[doctor.bairro, doctor.cidade]
                        .filter(Boolean)
                        .join(' · ') || 'Localização não informada'}
                    </div>
                  </div>
                </div>

                {doctor.observacoes && (
                  <p className="doctor-notes">{doctor.observacoes}</p>
                )}

                <div className="doctor-card-footer">
                  <div className="doctor-shifts" aria-label="Turno de atendimento">
                    {OPCOES_TURNO.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={shift === option ? 'doctor-shift-active' : ''}
                        onClick={() => onUpdateShift(doctor.id, option, doctor.descricao || '')}
                      >
                        {option === 'Manhã e Tarde' ? 'Integral' : option}
                      </button>
                    ))}
                  </div>
                  <div className="doctor-contact-actions">
                    <button
                      type="button"
                      className="doctor-secondary-button doctor-map-button"
                      disabled={locatingId !== null}
                      onClick={() => openNavigation(doctor)}
                    >
                      {locatingId === doctor.id
                        ? 'Obtendo GPS...'
                        : doctor.map_link?.trim()
                          ? 'Abrir mapa'
                          : 'Capturar GPS'}
                    </button>
                    {doctor.telefone && (
                      <button
                        type="button"
                        className="doctor-whatsapp-button"
                        onClick={() => openWhatsApp(doctor.telefone)}
                      >
                        WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
