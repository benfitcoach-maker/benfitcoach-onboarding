import { useState } from 'react';
import { getNutritionConsultations, getClient } from './store';
import { exportConsultationPDF, exportFicheFrigoPDF } from './nutritionPdf';
import ProgressionCharts from './ProgressionCharts';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NutritionHistory({ clientId, onBack, isAnissa, onEditConsultation }) {
  const client = getClient(clientId);
  const consultations = getNutritionConsultations(clientId);
  const [expanded, setExpanded] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'progression'

  const hasFollowups = consultations.some(c => c.isFollowup && c.followupData);

  const toggle = (id) => setExpanded(expanded === id ? null : id);

  const handleExportPDF = async (consultation, e) => {
    e.stopPropagation();
    await exportConsultationPDF(consultation, client);
  };

  const handleExportFrigo = async (consultation, e) => {
    e.stopPropagation();
    await exportFicheFrigoPDF(consultation, client);
  };

  const renderFollowupSummary = (c) => {
    if (!c.isFollowup || !c.followupData) return null;
    const fd = c.followupData;
    return (
      <div className="nutrition-history-section followup-history-section">
        <strong>Suivi & Progression</strong>
        <div className="followup-history-grid">
          {fd.etat_global && <div><span className="fh-label">Etat global :</span> {fd.etat_global}</div>}
          {fd.energie && <div><span className="fh-label">Energie :</span> {fd.energie}</div>}
          {fd.sommeil && <div><span className="fh-label">Sommeil :</span> {fd.sommeil}</div>}
          {fd.digestion && <div><span className="fh-label">Digestion :</span> {fd.digestion}</div>}
          {fd.stress && <div><span className="fh-label">Stress :</span> {fd.stress}</div>}
          {fd.douleurs && <div><span className="fh-label">Douleurs :</span> {fd.douleurs}</div>}
          {fd.adherence_plan && <div><span className="fh-label">Adherence plan :</span> {fd.adherence_plan}</div>}
          {fd.poids_actuel && <div><span className="fh-label">Poids :</span> {fd.poids_actuel} kg</div>}
          {fd.tour_taille && <div><span className="fh-label">Tour taille :</span> {fd.tour_taille} cm</div>}
          {fd.tour_hanche && <div><span className="fh-label">Tour hanche :</span> {fd.tour_hanche} cm</div>}
        </div>
        {fd.observations_progression && (
          <div style={{ marginTop: 8 }}>
            <span className="fh-label">Observations progression :</span>
            <p style={{ marginTop: 4 }}>{fd.observations_progression}</p>
          </div>
        )}
        {fd.points_ameliorer && (
          <div style={{ marginTop: 6 }}>
            <span className="fh-label">Points a ameliorer :</span>
            <p style={{ marginTop: 4 }}>{fd.points_ameliorer}</p>
          </div>
        )}
        {fd.objectifs_prochains && (
          <div style={{ marginTop: 6 }}>
            <span className="fh-label">Objectifs prochains :</span>
            <p style={{ marginTop: 4 }}>{fd.objectifs_prochains}</p>
          </div>
        )}
      </div>
    );
  };

  const renderConsultation = (c, showPrivate) => (
    <div className="history-item-body">
      {c.isFollowup && renderFollowupSummary(c)}

      {c.observations && (
        <div className="nutrition-history-section">
          <strong>Observations</strong>
          <p>{c.observations}</p>
        </div>
      )}

      <div className="nutrition-history-section">
        <strong>Bilans</strong>
        <p>
          Bilan sanguin : {c.bloodTestDone ? 'Oui' : 'Non'} |
          Analyse ADN : {c.dnaTestDone ? 'Oui' : 'Non'}
        </p>
      </div>

      {c.nutritionalObservations && (
        <div className="nutrition-history-section">
          <strong>Observations nutritionnelles</strong>
          <p>{c.nutritionalObservations}</p>
        </div>
      )}

      {c.nutritionPlan && (
        <div className="nutrition-history-section">
          <strong>Plan nutrition</strong>
          <pre className="nutrition-plan-text">{c.nutritionPlan}</pre>
        </div>
      )}

      {c.supplements && (
        <div className="nutrition-history-section">
          <strong>Supplements</strong>
          <pre className="nutrition-plan-text">{c.supplements}</pre>
        </div>
      )}

      {c.recipes && (
        <div className="nutrition-history-section">
          <strong>Recettes recommandees</strong>
          <pre className="nutrition-plan-text">{c.recipes}</pre>
        </div>
      )}

      {c.notesForCoach && (
        <div className="nutrition-history-section">
          <strong>Notes pour Benoit</strong>
          <p>{c.notesForCoach}</p>
        </div>
      )}

      {showPrivate && c.privateNotes && (
        <div className="nutrition-history-section private-section">
          <strong><span className="private-lock">🔒</span> Notes privees</strong>
          <p>{c.privateNotes}</p>
        </div>
      )}
    </div>
  );

  // Compare mode: last 2 consultations side by side
  if (compareMode && consultations.length >= 2) {
    const latest = consultations[0];
    const previous = consultations[1];
    return (
      <div className={`history-panel ${isAnissa ? 'anissa-history' : ''}`}>
        <div className="history-header">
          <button className="btn btn-sm btn-secondary" onClick={() => setCompareMode(false)}>&larr; Retour</button>
          <h2>Comparaison des consultations</h2>
        </div>
        <div className="compare-grid">
          <div className="compare-col">
            <div className="compare-col-header">
              <strong>Derniere consultation</strong>
              <span>{formatDate(latest.date)}</span>
            </div>
            {renderConsultation(latest, isAnissa)}
          </div>
          <div className="compare-col">
            <div className="compare-col-header">
              <strong>Consultation precedente</strong>
              <span>{formatDate(previous.date)}</span>
            </div>
            {renderConsultation(previous, isAnissa)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`history-panel ${isAnissa ? 'anissa-history' : ''}`}>
      <div className="history-header">
        <button className="btn btn-sm btn-secondary" onClick={onBack}>&larr; Retour</button>
        <h2>{isAnissa ? 'Consultations nutrition' : 'Notes nutrition - Anissa'}</h2>
        <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
          {client?.form?.prenom || 'Client'}
        </span>
        {consultations.length >= 2 && (
          <button className="btn btn-sm btn-anissa-secondary" style={{ marginLeft: 'auto' }} onClick={() => setCompareMode(true)}>
            Comparer
          </button>
        )}
      </div>

      {/* Tabs: List / Progression */}
      {hasFollowups && (
        <div className="history-tabs">
          <button
            className={`history-tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Consultations
          </button>
          <button
            className={`history-tab ${activeTab === 'progression' ? 'active' : ''}`}
            onClick={() => setActiveTab('progression')}
          >
            Courbe de progression
          </button>
        </div>
      )}

      {activeTab === 'progression' && hasFollowups ? (
        <ProgressionCharts consultations={consultations} />
      ) : (
        <>
          {consultations.length === 0 ? (
            <div className="dashboard-empty">
              <p>Aucune consultation nutrition pour ce client.</p>
            </div>
          ) : (
            <div className="history-list">
              {consultations.map(c => (
                <div key={c.id} className="history-item">
                  <div className="history-item-header" onClick={() => toggle(c.id)}>
                    <span className="history-date">{formatDate(c.date)}</span>
                    <span className="history-sections">
                      {c.isFollowup && <span className="followup-tag">Suivi</span>}
                      {c.bloodTestDone && '  Bilan sanguin'}
                      {c.dnaTestDone && '  ADN'}
                      {c.nutritionPlan ? ` - ${c.label || 'Plan genere'}` : ''}
                    </span>
                    <div className="history-item-actions">
                      {isAnissa && (
                        <>
                          {onEditConsultation && (
                            <button className="btn btn-xs btn-anissa-primary" onClick={(e) => { e.stopPropagation(); onEditConsultation(c); }} style={{ marginRight: 4 }}>
                              Modifier
                            </button>
                          )}
                          {c.nutritionPlan && (
                            <>
                              <button className="btn btn-xs btn-anissa-secondary" onClick={(e) => handleExportPDF(c, e)}>
                                PDF
                              </button>
                              <button className="btn btn-xs btn-anissa-secondary" onClick={(e) => handleExportFrigo(c, e)} style={{ marginLeft: 4 }}>
                                Fiche Frigo
                              </button>
                            </>
                          )}
                        </>
                      )}
                      <span className="history-toggle">{expanded === c.id ? 'Fermer' : 'Voir'}</span>
                    </div>
                  </div>
                  {expanded === c.id && renderConsultation(c, isAnissa)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
