// services-provider.rules.test.mjs
//
// Firestore Emulator Suite rules tests for the entire Services/Provider
// marketplace feature (SERVICES_PROVIDER_PLAN.md). Every phase's
// PROGRESS.md flagged "no emulator tests yet" as outstanding debt — this
// file closes that out in one pass across all three rule surfaces
// (providers/{uid}, services/{serviceId}+bookings, bookingAlerts), per
// the explicit note in Phase 2's progress notes that these should be
// tested together rather than three separate efforts.
//
// Run with: npm test (from this directory) — requires the Firebase CLI
// and the Firestore emulator (firebase.json here points --rules at the
// real firestore.rules two directories up, so this suite always tests
// the actual shipped rules file, not a copy).
//
// Project layout assumed: this file sits in
// _services_provider_progress/emulator-tests/ and firestore.rules is at
// the repo root (../../firestore.rules from here).

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { describe, it, before, after, beforeEach } from 'mocha';

const PROJECT_ID = 'kuetx-services-provider-test';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('../../firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Convenience: a plain authenticated context for a given uid.
function asUser(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

// isAdmin() (see firestore.rules) checks for the EXISTENCE of a doc at
// admins/{uid} — not a custom auth claim — so "being an admin" in these
// tests means seeding that doc with rules disabled first, then handing
// back a normal authenticated context for that same uid. Every call site
// below that needs an admin actor must await this (it's async, unlike a
// plain asUser()), since the seed write has to land before the admin
// context is used.
async function asAdmin(uid) {
  await withAdminBypass(async (db) => {
    await setDoc(doc(db, 'admins', uid), {});
  });
  return testEnv.authenticatedContext(uid).firestore();
}

function asAnon() {
  return testEnv.unauthenticatedContext().firestore();
}

// Seed helper — writes directly with security rules disabled, for
// setting up fixture state that a plain client couldn't legally write
// itself (e.g. a pre-verified provider, an existing booking in a given
// state). This mirrors what "arrange" phase of these tests needs vs.
// what the "act" phase is actually testing.
async function withAdminBypass(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

describe('providers/{uid} (Phase 1, §3-4)', () => {
  it('an unauthenticated user cannot create a provider doc', async () => {
    const db = asAnon();
    await assertFails(setDoc(doc(db, 'providers', 'p1'), {
      status: 'pending', verifiedAt: null, displayName: 'Test Salon', serviceType: 'salon',
    }));
  });

  it('a signed-in user can create their OWN provider doc as pending, never any other status', async () => {
    const db = asUser('p1');
    await assertSucceeds(setDoc(doc(db, 'providers', 'p1'), {
      status: 'pending', verifiedAt: null, rejectedReason: null,
      displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      requestedAt: serverTimestamp(),
    }));
  });

  it('cannot self-create as already verified (no client self-grant)', async () => {
    const db = asUser('p1');
    await assertFails(setDoc(doc(db, 'providers', 'p1'), {
      status: 'verified', verifiedAt: serverTimestamp(), displayName: 'Test Salon', serviceType: 'salon',
    }));
  });

  it('cannot create a provider doc with phone as a field on the parent doc', async () => {
    const db = asUser('p1');
    await assertFails(setDoc(doc(db, 'providers', 'p1'), {
      status: 'pending', verifiedAt: null, displayName: 'Test Salon',
      serviceType: 'salon', phone: '017xxxxxxxx',
    }));
  });

  it('a rejected provider can resubmit (rejected -> pending) touching only allowed fields', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'providers', 'p1'), {
        status: 'rejected', verifiedAt: null, rejectedReason: 'bad info',
        displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      });
    });
    const db = asUser('p1');
    await assertSucceeds(updateDoc(doc(db, 'providers', 'p1'), {
      status: 'pending', rejectedReason: null, displayName: 'Test Salon v2',
      requestedAt: serverTimestamp(),
    }));
  });

  it('a provider cannot self-verify by touching status directly to verified', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'providers', 'p1'), {
        status: 'pending', verifiedAt: null, displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      });
    });
    const db = asUser('p1');
    await assertFails(updateDoc(doc(db, 'providers', 'p1'), { status: 'verified', verifiedAt: serverTimestamp() }));
  });

  it('only an admin can verify a provider', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'providers', 'p1'), {
        status: 'pending', verifiedAt: null, displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      });
    });
    const admin = await asAdmin('founder1');
    await assertSucceeds(updateDoc(doc(admin, 'providers', 'p1'), {
      status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: 'founder1', rejectedReason: null,
    }));
  });

  describe('providers/{uid}/contact/phone (§10 gating)', () => {
    beforeEach(async () => {
      await withAdminBypass(async (db) => {
        await setDoc(doc(db, 'providers', 'p1'), {
          status: 'verified', verifiedAt: serverTimestamp(), displayName: 'Test Salon',
          serviceType: 'salon', serviceIds: ['svc1'],
        });
        await setDoc(doc(db, 'providers', 'p1', 'contact', 'phone'), { value: '017xxxxxxxx' });
        await setDoc(doc(db, 'services', 'svc1'), {
          type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: true,
          offerings: [], revenueTotal: 0,
        });
      });
    });

    it('the owning provider can read their own phone', async () => {
      const db = asUser('p1');
      await assertSucceeds(getDoc(doc(db, 'providers', 'p1', 'contact', 'phone')));
    });

    it('a student with no booking cannot read the phone', async () => {
      const db = asUser('student1');
      await assertFails(getDoc(doc(db, 'providers', 'p1', 'contact', 'phone')));
    });

    it('a student WITH a confirmedStudents marker can read the phone', async () => {
      await withAdminBypass(async (db) => {
        await setDoc(doc(db, 'services', 'svc1', 'confirmedStudents', 'student1'), {});
      });
      const db = asUser('student1');
      await assertSucceeds(getDoc(doc(db, 'providers', 'p1', 'contact', 'phone')));
    });

    it('a student cannot write their own confirmedStudents marker', async () => {
      const db = asUser('student1');
      await assertFails(setDoc(doc(db, 'services', 'svc1', 'confirmedStudents', 'student1'), {}));
    });

    it('the admin (Founder) can read the phone for verification purposes', async () => {
      const admin = await asAdmin('founder1');
      await assertSucceeds(getDoc(doc(admin, 'providers', 'p1', 'contact', 'phone')));
    });
  });
});

describe('services/{serviceId} (Phase 2, §2 §5-7)', () => {
  it('an unverified provider cannot create a service', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'providers', 'p1'), {
        status: 'pending', verifiedAt: null, displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      });
    });
    const db = asUser('p1');
    await assertFails(setDoc(doc(db, 'services', 'svc1'), {
      type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: false, offerings: [], revenueTotal: 0,
    }));
  });

  it('a verified provider CAN create their own service starting closed with zero revenue', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'providers', 'p1'), {
        status: 'verified', verifiedAt: serverTimestamp(), displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      });
    });
    const db = asUser('p1');
    await assertSucceeds(setDoc(doc(db, 'services', 'svc1'), {
      type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: false, offerings: [], revenueTotal: 0,
    }));
  });

  it('a verified provider cannot create a service claiming a different providerUid', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'providers', 'p1'), {
        status: 'verified', verifiedAt: serverTimestamp(), displayName: 'Test Salon', serviceType: 'salon', serviceIds: [],
      });
    });
    const db = asUser('p1');
    await assertFails(setDoc(doc(db, 'services', 'svc1'), {
      type: 'salon', providerUid: 'someone-else', name: 'Test Salon', isOpen: false, offerings: [], revenueTotal: 0,
    }));
  });

  it('a provider cannot directly inflate their own revenueTotal', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'services', 'svc1'), {
        type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: true, offerings: [], revenueTotal: 0,
      });
    });
    const db = asUser('p1');
    await assertFails(updateDoc(doc(db, 'services', 'svc1'), { revenueTotal: 999999 }));
  });

  describe('bookings/{bookingId} — create-time gates (Gap 5, Gap 7, now server-side)', () => {
    beforeEach(async () => {
      await withAdminBypass(async (db) => {
        await setDoc(doc(db, 'services', 'svc1'), {
          type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: true,
          offerings: [{ id: 'off1', label: 'Haircut', isAvailable: true }],
          revenueTotal: 0,
        });
      });
    });

    it('Gap 5: booking a closed (isOpen: false) service is rejected', async () => {
      await withAdminBypass(async (db) => {
        await updateDoc(doc(db, 'services', 'svc1'), { isOpen: false });
      });
      const db = asUser('student1');
      await assertFails(setDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        studentUid: 'student1', offeringId: 'off1', preferredTime: null,
        status: 'pending', cancelledBy: null, confirmedSlot: null,
      }));
    });

    it('Gap 5: booking a disabled offering is rejected', async () => {
      await withAdminBypass(async (db) => {
        await updateDoc(doc(db, 'services', 'svc1'), {
          offerings: [{ id: 'off1', label: 'Haircut', isAvailable: false }],
        });
      });
      const db = asUser('student1');
      await assertFails(setDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        studentUid: 'student1', offeringId: 'off1', preferredTime: null,
        status: 'pending', cancelledBy: null, confirmedSlot: null,
      }));
    });

    it('Gap 7: a second booking while an activeBooking marker exists is rejected', async () => {
      await withAdminBypass(async (db) => {
        await setDoc(doc(db, 'services', 'svc1', 'activeBooking', 'student1'), {});
      });
      const db = asUser('student1');
      await assertFails(setDoc(doc(db, 'services', 'svc1', 'bookings', 'b2'), {
        studentUid: 'student1', offeringId: 'off1', preferredTime: null,
        status: 'pending', cancelledBy: null, confirmedSlot: null,
      }));
    });

    it('a normal booking on an open service + available offering + no active marker succeeds', async () => {
      const db = asUser('student1');
      await assertSucceeds(setDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        studentUid: 'student1', offeringId: 'off1', preferredTime: null,
        status: 'pending', cancelledBy: null, confirmedSlot: null,
      }));
    });

    it('a student cannot create a booking claiming a different studentUid', async () => {
      const db = asUser('student1');
      await assertFails(setDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        studentUid: 'someone-else', offeringId: 'off1', preferredTime: null,
        status: 'pending', cancelledBy: null, confirmedSlot: null,
      }));
    });
  });

  describe('bookings/{bookingId} — state transitions (§7, Gap 1/3/8)', () => {
    beforeEach(async () => {
      await withAdminBypass(async (db) => {
        await setDoc(doc(db, 'services', 'svc1'), {
          type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: true, offerings: [], revenueTotal: 0,
        });
        await setDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
          studentUid: 'student1', offeringId: 'off1', preferredTime: null,
          status: 'pending', cancelledBy: null, confirmedSlot: null,
        });
      });
    });

    it('owner can confirm a pending booking (status + confirmedSlot only)', async () => {
      const db = asUser('p1');
      await assertSucceeds(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        status: 'confirmed', confirmedSlot: { date: '2026-08-01', time: '10:00' },
      }));
    });

    it('a student cannot confirm their own booking', async () => {
      const db = asUser('student1');
      await assertFails(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        status: 'confirmed', confirmedSlot: null,
      }));
    });

    it('Gap 8: confirming an already-confirmed booking again is rejected (no double-confirm)', async () => {
      await withAdminBypass(async (db) => {
        await updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), { status: 'confirmed' });
      });
      const db = asUser('p1');
      await assertFails(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        status: 'confirmed', confirmedSlot: { date: '2026-08-01', time: '11:00' },
      }));
    });

    it('Gap 1: the student can cancel their own pending booking, stamping cancelledBy: student', async () => {
      const db = asUser('student1');
      await assertSucceeds(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        status: 'cancelled', cancelledBy: 'student',
      }));
    });

    it('a student cannot cancel and blame it on the owner', async () => {
      const db = asUser('student1');
      await assertFails(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        status: 'cancelled', cancelledBy: 'owner',
      }));
    });

    it('Gap 3: the owner can cancel a CONFIRMED booking (no-show), stamping cancelledBy: owner', async () => {
      await withAdminBypass(async (db) => {
        await updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), { status: 'confirmed' });
      });
      const db = asUser('p1');
      await assertSucceeds(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        status: 'cancelled', cancelledBy: 'owner',
      }));
    });

    it('a terminal (cancelled) booking cannot be transitioned again', async () => {
      await withAdminBypass(async (db) => {
        await updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), { status: 'cancelled', cancelledBy: 'student' });
      });
      const db = asUser('p1');
      await assertFails(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), { status: 'confirmed' }));
    });

    it('owner can mark a confirmed booking done (status only)', async () => {
      await withAdminBypass(async (db) => {
        await updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), { status: 'confirmed' });
      });
      const db = asUser('p1');
      await assertSucceeds(updateDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), { status: 'done' }));
    });

    it('a student can never read another student\u2019s booking', async () => {
      const db = asUser('student2');
      await assertFails(getDoc(doc(db, 'services', 'svc1', 'bookings', 'b1')));
    });

    it('the owning provider CAN read a booking on their own service', async () => {
      const db = asUser('p1');
      await assertSucceeds(getDoc(doc(db, 'services', 'svc1', 'bookings', 'b1')));
    });
  });
});

describe('bookingAlerts/{uid}/items/{alertId} (Phase 3 Part 2, §9)', () => {
  beforeEach(async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'services', 'svc1'), {
        type: 'salon', providerUid: 'p1', name: 'Test Salon', isOpen: true, offerings: [], revenueTotal: 0,
      });
      await setDoc(doc(db, 'services', 'svc1', 'bookings', 'b1'), {
        studentUid: 'student1', offeringId: 'off1', preferredTime: null,
        status: 'pending', cancelledBy: null, confirmedSlot: null,
      });
    });
  });

  it('the booking\u2019s own student can have an alert created for them (e.g. by the confirm transaction)', async () => {
    const db = asUser('p1'); // confirmBooking runs as the owner
    await assertSucceeds(setDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1'), {
      kind: 'booking_confirmed', serviceId: 'svc1', bookingId: 'b1', read: false,
      message: 'test', createdAt: serverTimestamp(),
    }));
  });

  it('an alert cannot be forged for an uninvolved third uid', async () => {
    const db = asUser('p1');
    await assertFails(setDoc(doc(db, 'bookingAlerts', 'random-uid-not-involved', 'items', 'a1'), {
      kind: 'booking_confirmed', serviceId: 'svc1', bookingId: 'b1', read: false,
      message: 'test', createdAt: serverTimestamp(),
    }));
  });

  it('the owner of the alert can mark it read but cannot change anything else', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1'), {
        kind: 'booking_confirmed', serviceId: 'svc1', bookingId: 'b1', read: false, message: 'test',
      });
    });
    const db = asUser('student1');
    await assertSucceeds(updateDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1'), { read: true }));
    await assertFails(updateDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1'), { message: 'tampered' }));
  });

  it('another user cannot read or delete someone else\u2019s alert', async () => {
    await withAdminBypass(async (db) => {
      await setDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1'), {
        kind: 'booking_confirmed', serviceId: 'svc1', bookingId: 'b1', read: false, message: 'test',
      });
    });
    const db = asUser('student2');
    await assertFails(getDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1')));
    await assertFails(deleteDoc(doc(db, 'bookingAlerts', 'student1', 'items', 'a1')));
  });
});
