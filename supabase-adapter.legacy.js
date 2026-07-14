// supabase-adapter.js — v13.0 FIXED
// طبقة توافق محسّنة: إصلاح حفظ البيانات في لوحة التحكم
(function () {
  async function waitForSupabaseGlobal() {
    for (var i = 0; i < 200; i++) {
      if (window.supabase && typeof window.supabase.createClient === 'function') return true;
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    throw new Error('Supabase library not loaded');
  }

  function makeDocSnapshot(row, id) {
    return {
      id: id,
      exists: function () { return !!row; },
      data: function () { return row ? (row.data || {}) : undefined; }
    };
  }

  function makeQuerySnapshot(rows) {
    var docs = (rows || []).map(function (row) {
      return {
        id: row.id,
        ref: { collection: row.collection, id: row.id },
        data: function () { return row.data || {}; }
      };
    });
    return {
      docs: docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: function (cb) { docs.forEach(cb); }
    };
  }

  function normalizeAuthUser(user) {
    if (!user) return null;
    return {
      uid: user.id,
      id: user.id,
      email: user.email || '',
      displayName: (user.user_metadata && (user.user_metadata.displayName || user.user_metadata.name)) || '',
      emailVerified: !!user.email_confirmed_at
    };
  }

  // ===== متغير عالمي لمنع التهيئة المزدوجة =====
  var _initPromise = null;

  async function initSupabaseAdapter() {
    // منع التهيئة المزدوجة — نعيد نفس الوعد إذا كانت التهيئة جارية
    if (_initPromise) return _initPromise;
    if (window.supabaseClient && window.firebaseDB && window.firebaseAuth) return Promise.resolve(true);

    _initPromise = (async function () {
      await waitForSupabaseGlobal();

      var cfg = window.HUD_SUPABASE_CONFIG;
      if (!cfg || !cfg.url || !cfg.anonKey) throw new Error('HUD_SUPABASE_CONFIG is missing');

      var client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });

      window.supabaseClient = client;
      window.supabaseDB = { client: client };
      window.db = window.supabaseDB;

      // ===== API المتوافق مع Firestore =====
      var api = {
        db: window.supabaseDB,
        doc: function (db, collection, id) { return { collection: collection, id: String(id) }; },
        collection: function (db, collection) { return { collection: collection }; },
        query: function (ref) { return ref; },
        where: function () { return {}; },
        orderBy: function () { return {}; },
        serverTimestamp: function () { return new Date().toISOString(); },

        async getDoc(ref) {
          var res = await client.from('hud_docs')
            .select('collection,id,data,created_at,updated_at')
            .eq('collection', ref.collection)
            .eq('id', ref.id)
            .maybeSingle();
          if (res.error) {
            console.error('[supabase-adapter] getDoc error:', res.error);
            throw res.error;
          }
          return makeDocSnapshot(res.data, ref.id);
        },

        async setDoc(ref, data, options) {
          var finalData = data || {};
          if (options && options.merge) {
            try {
              var old = await api.getDoc(ref);
              if (old.exists()) finalData = Object.assign({}, old.data(), data || {});
            } catch (mergeErr) {
              console.warn('[supabase-adapter] merge getDoc failed, using new data only:', mergeErr);
            }
          }
          // إضافة timestamp للتحديث
          var payload = {
            collection: ref.collection,
            id: ref.id,
            data: finalData,
            updated_at: new Date().toISOString()
          };
          var res = await client.from('hud_docs').upsert(payload, { onConflict: 'collection,id' });
          if (res.error) {
            console.error('[supabase-adapter] setDoc error:', res.error, 'ref:', ref, 'payload:', payload);
            throw res.error;
          }
          console.log('[supabase-adapter] setDoc OK:', ref.collection, '/', ref.id);
          return true;
        },

        async updateDoc(ref, data) {
          try {
            var old = await api.getDoc(ref);
            var finalData = Object.assign({}, old.exists() ? old.data() : {}, data || {});
            return api.setDoc(ref, finalData);
          } catch (e) {
            console.error('[supabase-adapter] updateDoc error:', e);
            throw e;
          }
        },

        async deleteDoc(ref) {
          var res = await client.from('hud_docs')
            .delete()
            .eq('collection', ref.collection)
            .eq('id', ref.id);
          if (res.error) {
            console.error('[supabase-adapter] deleteDoc error:', res.error);
            throw res.error;
          }
          return true;
        },

        async getDocs(ref) {
          var res = await client.from('hud_docs')
            .select('collection,id,data,created_at,updated_at')
            .eq('collection', ref.collection)
            .order('updated_at', { ascending: false });
          if (res.error) {
            console.error('[supabase-adapter] getDocs error:', res.error);
            throw res.error;
          }
          return makeQuerySnapshot(res.data || []);
        },

        async addDoc(ref, data) {
          var id = 'doc-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
          await api.setDoc({ collection: ref.collection, id: id }, Object.assign({ id: id }, data || {}));
          return { id: id };
        },

        onSnapshot: function (ref, callback, errorCallback) {
          var collection = ref.collection;
          var isDoc = !!ref.id;

          async function emit() {
            try {
              if (isDoc) callback(await api.getDoc(ref));
              else callback(await api.getDocs(ref));
            } catch (e) {
              if (errorCallback) errorCallback(e);
            }
          }

          emit();

          var channelName = 'hud_' + collection + '_' + (ref.id || 'all') + '_' + Math.random().toString(36).substr(2, 6);
          var channel = client.channel(channelName)
            .on('postgres_changes', {
              event: '*', schema: 'public', table: 'hud_docs',
              filter: 'collection=eq.' + collection
            }, function (payload) {
              if (isDoc) {
                var changedId = (payload.new && payload.new.id) || (payload.old && payload.old.id);
                if (changedId !== ref.id) return;
              }
              emit();
            })
            .subscribe();

          return function unsubscribe() {
            try { client.removeChannel(channel); } catch (e) {}
          };
        }
      };

      // ===== Auth API =====
      var authCompat = {
        client: client,
        async getCurrentUser() {
          var res = await client.auth.getUser();
          return normalizeAuthUser(res && res.data ? res.data.user : null);
        },
        onAuthStateChanged: function (callback) {
          client.auth.getUser().then(function (res) {
            callback(normalizeAuthUser(res && res.data ? res.data.user : null));
          }).catch(function () { callback(null); });
          var sub = client.auth.onAuthStateChange(function (event, session) {
            callback(normalizeAuthUser(session && session.user));
          });
          return function () { try { sub.data.subscription.unsubscribe(); } catch (e) {} };
        },
        async signOut() { return client.auth.signOut(); },
        async signInWithEmailAndPassword(email, password) {
          var res = await client.auth.signInWithPassword({ email: email, password: password });
          if (res.error) throw res.error;
          return { user: normalizeAuthUser(res.data.user), rawUser: res.data.user };
        },
        async createUserWithEmailAndPassword(email, password, metadata) {
          var res = await client.auth.signUp({ email: email, password: password, options: { data: metadata || {} } });
          if (res.error) throw res.error;
          return { user: normalizeAuthUser(res.data.user), rawUser: res.data.user };
        },
        async updateProfile(user, profile) {
          var res = await client.auth.updateUser({ data: profile || {} });
          if (res.error) throw res.error;
          return true;
        },
        async sendPasswordResetEmail(email) {
          var res = await client.auth.resetPasswordForEmail(email);
          if (res.error) throw res.error;
          return true;
        }
      };

      // ===== تسجيل في window =====
      window.firebaseDB = api;
      window.firebaseAuth = authCompat;
      window.doc = api.doc.bind(api);
      window.setDoc = api.setDoc.bind(api);
      window.updateDoc = api.updateDoc.bind(api);
      window.getDoc = api.getDoc.bind(api);
      window.getDocs = api.getDocs.bind(api);
      window.deleteDoc = api.deleteDoc.bind(api);
      window.collection = api.collection.bind(api);

      console.log('[supabase-adapter] ✅ تم تهيئة Supabase بنجاح. URL:', cfg.url);
      return true;
    })();

    return _initPromise;
  }

  window.initSupabaseAdapter = initSupabaseAdapter;
})();
