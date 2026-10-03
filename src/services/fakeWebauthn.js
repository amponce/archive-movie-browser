// A fake WebAuthn library for tests: options echo a fixed challenge; verification succeeds when
// the response carries the expected challenge and credential, fails otherwise
export const rp = { rpID: 'orphanedfilms.com', origin: 'https://www.orphanedfilms.com' };
const cd = challenge => Buffer.from(JSON.stringify({ challenge })).toString('base64url');
export const resp = (id, challenge, extra = {}) => ({ id, response: { clientDataJSON: cd(challenge) }, ...extra });

export const fakeWebauthn = () => {
  let n = 0;
  return {
    generateRegistrationOptions: async (o) => ({ challenge: `reg${++n}`, user: { id: o.userID }, rp: { id: o.rpID }, o }),
    verifyRegistrationResponse: async ({ response, expectedOrigin, expectedRPID }) => (
      expectedOrigin === rp.origin && expectedRPID === rp.rpID
        ? { verified: true, registrationInfo: { credential: { id: response.id, publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } } }
        : { verified: false }),
    generateAuthenticationOptions: async () => ({ challenge: `auth${++n}` }),
    verifyAuthenticationResponse: async ({ response, credential }) => (
      response.id === credential.id
        ? { verified: true, authenticationInfo: { newCounter: (response.counter ?? credential.counter + 1) } }
        : { verified: false }),
  };
};
