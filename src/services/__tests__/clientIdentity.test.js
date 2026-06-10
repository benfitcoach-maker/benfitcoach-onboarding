import { describe, it, expect } from 'vitest';
import {
  resolveClientIdentity,
  clientIdentityFields,
  hasClientIdentity,
} from '../clientIdentity';

describe('clientIdentity', () => {
  describe('resolveClientIdentity', () => {
    it('priorise form.email sur client.email', () => {
      const client = { form: { email: 'form@x.ch' }, email: 'top@x.ch' };
      expect(resolveClientIdentity(client).email).toBe('form@x.ch');
    });

    it('fallback sur client.email si form.email absent', () => {
      expect(resolveClientIdentity({ email: 'top@x.ch' }).email).toBe('top@x.ch');
    });

    it('priorise stagingClientId, fallback staging_client_id', () => {
      expect(resolveClientIdentity({ stagingClientId: 'a' }).clientId).toBe('a');
      expect(resolveClientIdentity({ staging_client_id: 'b' }).clientId).toBe('b');
    });

    it('renvoie null/null pour un client vide', () => {
      expect(resolveClientIdentity({})).toEqual({ email: null, clientId: null });
      expect(resolveClientIdentity(null)).toEqual({ email: null, clientId: null });
    });
  });

  describe('clientIdentityFields', () => {
    it('etale email ET client_id quand les deux sont connus', () => {
      const client = { form: { email: 'c@x.ch' }, stagingClientId: 'id-1' };
      expect(clientIdentityFields(client)).toEqual({ email: 'c@x.ch', client_id: 'id-1' });
    });

    it('n ajoute jamais de cle a null (email seul)', () => {
      expect(clientIdentityFields({ email: 'c@x.ch' })).toEqual({ email: 'c@x.ch' });
    });

    it('n ajoute jamais de cle a null (client_id seul — cliente hide-my-email)', () => {
      expect(clientIdentityFields({ stagingClientId: 'id-1' })).toEqual({ client_id: 'id-1' });
    });

    it('objet vide si aucun identifiant', () => {
      expect(clientIdentityFields({})).toEqual({});
    });
  });

  describe('hasClientIdentity', () => {
    it('true si email seul, client_id seul, ou les deux', () => {
      expect(hasClientIdentity({ email: 'c@x.ch' })).toBe(true);
      expect(hasClientIdentity({ stagingClientId: 'id-1' })).toBe(true);
      expect(hasClientIdentity({ form: { email: 'c@x.ch' }, staging_client_id: 'id-1' })).toBe(true);
    });

    it('false si aucun identifiant', () => {
      expect(hasClientIdentity({})).toBe(false);
      expect(hasClientIdentity(null)).toBe(false);
    });
  });
});
