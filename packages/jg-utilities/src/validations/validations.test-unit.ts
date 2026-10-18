// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IUuidVersion } from '../shared/types.js';

import { MAX_EMAIL_LENGTH } from './constants.js';
import {
  isArrayValid,
  isAuthorizationHeaderValid,
  isBigIntStringValid,
  isEmailValid,
  isFileNameValid,
  isIntegerValid,
  isJwtValid,
  isNumberValid,
  isNumeric,
  isObjectValid,
  isOTPSecretValid,
  isOTPTokenValid,
  isPasswordValid,
  isSemverValid,
  isSlugValid,
  isStringValid,
  isTimestampValid,
  isUrlValid,
  isUuidValid,
} from './validations.js';

describe('isStringValid', () => {
  test.each([
    // essential
    ['', 0, undefined, false, true],
    [' ', undefined, undefined, false, true],
    [' \n\n', undefined, undefined, false, true],
    ['Hello World!', undefined, undefined, undefined, true],

    // ranges
    ['', 1, undefined, undefined, false],
    ['A', 1, undefined, undefined, true],
    ['ABCDE', undefined, 5, undefined, true],
    ['ABCDEF', undefined, 5, undefined, false],
    ['ABCDEF', 1, 5, undefined, false],
    ['AB', 3, 6, undefined, false],
    ['ABC', 3, 6, undefined, true],

    // bad data types
    ['', undefined, undefined, undefined, false],
    [' ', undefined, undefined, undefined, false],
    ['     ', undefined, undefined, undefined, false],
    ['     \n', undefined, undefined, undefined, false],
    ['  \n   \n', undefined, undefined, undefined, false],
    [undefined, undefined, undefined, undefined, false],
    [null, undefined, undefined, undefined, false],
    [{}, undefined, undefined, undefined, false],
    [[], undefined, undefined, undefined, false],
    [1, undefined, undefined, undefined, false],
    [true, undefined, undefined, undefined, false],
  ])('isStringValid(%s, %i, %i, %s) -> %s', (a, b, c, d, expected) => {
    expect(isStringValid(a, b, c, d)).toBe(expected);
  });
});

describe('isNumberValid', () => {
  test.each([
    // essential
    [1, undefined, undefined, true],
    [0, undefined, undefined, true],
    [-1, undefined, undefined, true],
    [Number.MIN_SAFE_INTEGER, undefined, undefined, true],
    [Number.MAX_SAFE_INTEGER, undefined, undefined, true],

    // ranges
    [0, 1, 5, false],
    [1, 1, 5, true],
    [2, 1, 5, true],
    [3, 1, 5, true],
    [4, 1, 5, true],
    [5, 1, 5, true],
    [6, 1, 5, false],
    [NaN, undefined, undefined, false],
    [NaN, 0, undefined, false],
    [Number.MIN_SAFE_INTEGER - 1, undefined, undefined, false],
    [Number.MAX_SAFE_INTEGER + 1, undefined, undefined, false],
    [Infinity, undefined, undefined, false],
    [-Infinity, undefined, undefined, false],
    [-1, 0, undefined, false],
    [1, undefined, 0, false],

    // bad data types
    [undefined, undefined, undefined, false],
    [null, undefined, undefined, false],
    [{}, undefined, undefined, false],
    [[], undefined, undefined, false],
    ['', undefined, undefined, false],
    ['1', undefined, undefined, false],
    [true, undefined, undefined, false],
  ])('isNumberValid(%s, %s, %s) -> %s', (a, b, c, expected) => {
    expect(isNumberValid(a, b, c)).toBe(expected);
  });
});

describe('isIntegerValid', () => {
  test.each([
    // essential
    [1, undefined, undefined, true],
    [0, undefined, undefined, true],
    [-1, undefined, undefined, true],
    [14400000, undefined, undefined, true],
    [Number.MAX_SAFE_INTEGER, undefined, undefined, true],
    [Number.MIN_SAFE_INTEGER, undefined, undefined, true],
    [1562851996000, undefined, undefined, true],

    // ranges
    [0, 1, 5, false],
    [1, 1, 5, true],
    [2, 1, 5, true],
    [3, 1, 5, true],
    [4, 1, 5, true],
    [5, 1, 5, true],
    [6, 1, 5, false],
    [NaN, 0, undefined, false],
    [-Infinity, 0, undefined, false],
    [Infinity, undefined, 1, false],
    [Number.MAX_SAFE_INTEGER + 1, undefined, undefined, false],
    [Number.MIN_SAFE_INTEGER - 1, undefined, undefined, false],

    // bad data types
    [undefined, undefined, undefined, false],
    [null, undefined, undefined, false],
    [{}, undefined, undefined, false],
    [[], undefined, undefined, false],
    ['', undefined, undefined, false],
    ['1', undefined, undefined, false],
    [true, undefined, undefined, false],
    [55.85, undefined, undefined, false],
    [Infinity, undefined, undefined, false],
    [-Infinity, undefined, undefined, false],
    [NaN, undefined, undefined, false],
  ])('isIntegerValid(%s, %s, %s) -> %s', (a, b, c, expected) => {
    expect(isIntegerValid(a, b, c)).toBe(expected);
  });
});

describe('isTimestampValid', () => {
  test.each([
    // valid
    [14400000, true],
    [Number.MAX_SAFE_INTEGER, true],
    [Date.now(), true],
    [1562851996000, true],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[], false],
    ['a', false],
    ['JESUSGRATEROL@', false],
    ['Jes15-Gratero_.!', false],
    ['@@', false],
    ['Jes15-Gratero_.as', false],
    ['jesu()', false],
    ['asdjkhxaslkdj546512asdkasd', false],
    ['', false],
    [' ', false],
    ['   ', false],
    [123, false],
    [true, false],
    [14300000, false],
    [Number.MAX_SAFE_INTEGER + 1, false],
    [14400000.5, false],
  ])('isTimestampValid(%s) -> %s', (a, expected) => {
    expect(isTimestampValid(a)).toBe(expected);
  });
});

describe('isNumeric', () => {
  test.each([
    // valid
    ['14400000', true],
    [String(Number.MAX_SAFE_INTEGER), true],
    [String(Date.now()), true],
    ['1562851996000', true],
    ['123.', true],
    ['123.55', true],
    ['123.558545', true],
    ['-123.558545', true],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[], false],
    ['a', false],
    ['JESUSGRATEROL@', false],
    ['Jes15-Gratero_.!', false],
    ['@@', false],
    ['Jes15-Gratero_.as', false],
    ['jesu()', false],
    ['asdjkhxaslkdj546512asdkasd', false],
    ['', false],
    [' ', false],
    ['   ', false],
    [123, false],
    [true, false],
    [14300000, false],
    [Number.MAX_SAFE_INTEGER + 1, false],
    [14400000.5, false],
    [' 123', false],
    [' 123 ', false],
    ['123.12.1', false],
    ['123,12', false],
    ['1,423.85', false],
    ['+1423.85', false],
  ])('isNumeric(%s) -> %s', (a, expected) => {
    expect(isNumeric(a as never)).toBe(expected);
  });
});

describe('isObjectValid', () => {
  test.each([
    // valid
    [{}, true, true],
    [{ foo: 'bar', auth: 123, isAdmin: true, obj: { some: 'obj', arr: [1, 2] } }, undefined, true],
    [{ foo: 'bar', auth: 123, isAdmin: true, obj: { some: 'obj', arr: [1, 2] } }, true, true],

    // invalid
    [undefined, undefined, false],
    [null, undefined, false],
    [{}, false, false],
    [[], false, false],
    [[], true, false],
    ['a', undefined, false],
    ['JESUSGRATEROL@', undefined, false],
    ['Jes15-Gratero_.!', undefined, false],
    ['@@', undefined, false],
    ['Jes15-Gratero_.as', undefined, false],
    ['jesu()', undefined, false],
    ['asdjkhxaslkdj546512asdkasd', undefined, false],
    ['', undefined, false],
    [' ', undefined, false],
    ['   ', undefined, false],
    [123, undefined, false],
    [true, undefined, false],
  ])('isObjectValid(%s, %s) -> %s', (a, b, expected) => {
    expect(isObjectValid(a, b)).toBe(expected);
  });
});

describe('isArrayValid', () => {
  test.each([
    // valid
    [[], true, true],
    [[1, 2, 3], undefined, true],
    [['a', 'b', 'c'], undefined, true],
    [
      [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      false,
      true,
    ],

    // invalid
    [undefined, undefined, false],
    [null, undefined, false],
    [{}, undefined, false],
    [[], false, false],
    ['a', undefined, false],
    ['JESUSGRATEROL@', undefined, false],
    ['Jes15-Gratero_.!', undefined, false],
    ['@@', undefined, false],
    ['Jes15-Gratero_.as', undefined, false],
    ['jesu()', undefined, false],
    ['asdjkhxaslkdj546512asdkasd', undefined, false],
    ['', undefined, false],
    [' ', undefined, false],
    ['   ', undefined, false],
    [123, undefined, false],
    [true, undefined, false],
  ])('isArrayValid(%s, %s) -> %s', (a, b, expected) => {
    expect(isArrayValid(a, b)).toBe(expected);
  });
});

describe('isEmailValid', () => {
  test.each(<Array<[string, string[] | undefined, boolean]>>[
    // valid
    ['jesusgraterol@gmail.com', undefined, true],
    ['hola@jesusgraterol.dev.com', undefined, true],
    ['jesusgraterol.dev@protonmail.com', undefined, true],
    ['jesusgraterol.dev@protonmail.net', undefined, true],
    ['jesusgraterol.dev@protonmail.con', ['.com'], true],
    ['jesusgraterol.dev@protonmail.con', [], true],

    // invalid
    ['jesusgraterol@gmail.com', ['.con', '.com'], false],
    ['jesusgraterol@gmail.con', ['.con', '.nen'], false],
    ['jesusgraterol@gmail.nen', ['.con', '.nen'], false],
    ['jesusgraterol@gmail.nen', ['.con', '.nen', '.ai'], false],
    ['jesusgraterol@gmail.ai', ['.con', '.nen', '.ai'], false],
    ['jesusgraterol@gmail.con', undefined, false],
    ['jesusgraterol@gmail.', undefined, false],
    ['jesusgraterol@gmail', undefined, false],
    ['domain.com', undefined, false],
    ['@domain.com', undefined, false],
    [
      'asd@domain.comasdasdasdasdasdasdasdasdasdasdasdasdasdasdaasdasdfasdfadasdsd',
      undefined,
      false,
    ],
  ])('isEmailValid(%s) -> %s', (value, forbiddenExtensions, expected) => {
    expect(isEmailValid(value, forbiddenExtensions)).toBe(expected);
  });

  test('accepts email addresses up to 320 characters', () => {
    const domain = ['b'.repeat(63), 'c'.repeat(63), 'd'.repeat(63), 'e'.repeat(63)].join('.');
    const emailAtMaxLength = `${'a'.repeat(64)}@${domain}`;
    const emailOverMaxLength = `${'a'.repeat(65)}@${domain}`;

    expect(emailAtMaxLength).toHaveLength(MAX_EMAIL_LENGTH);
    expect(isEmailValid(emailAtMaxLength)).toBe(true);
    expect(emailOverMaxLength).toHaveLength(MAX_EMAIL_LENGTH + 1);
    expect(isEmailValid(emailOverMaxLength)).toBe(false);
  });
});

describe('isSlugValid', () => {
  test.each([
    // valid
    ['jesusgraterol', undefined, undefined, true],
    ['jes15-graterol', undefined, undefined, true],
    ['je', undefined, undefined, true],
    ['15', undefined, undefined, true],
    ['xd', undefined, undefined, true],
    ['herassio-test', undefined, undefined, true],
    ['pythonwiz333', undefined, undefined, true],
    ['restapi12', undefined, undefined, true],

    // ranges
    ['j', 2, 5, false],
    ['je', 2, 5, true],
    ['jes', 2, 5, true],
    ['jesu', 2, 5, true],
    ['jesus', 2, 5, true],
    ['jesusg', 2, 5, false],

    // invalid
    [undefined, undefined, undefined, false],
    [null, undefined, undefined, false],
    [{}, undefined, undefined, false],
    [[], undefined, undefined, false],
    ['__', undefined, undefined, false],
    ['a', undefined, undefined, false],
    ['-bad-slug', undefined, undefined, false],
    ['bad-slug-', undefined, undefined, false],
    ['PythonWiz333', undefined, undefined, false],
    ['Herassio-.', undefined, undefined, false],
    ['JESUSGRATEROL', undefined, undefined, false],
    ['JESUSGRATEROL@', undefined, undefined, false],
    ['Jes15-Gratero_.!', undefined, undefined, false],
    ['@@', undefined, undefined, false],
    ['Jes15-Gratero_.as', undefined, undefined, false],
    ['jesu()', undefined, undefined, false],
    ['asdjkhxaslkdj546512asdkasd', undefined, undefined, false],
    ['', undefined, undefined, false],
    [' ', undefined, undefined, false],
    ['   ', undefined, undefined, false],
    [123, undefined, undefined, false],
    [true, undefined, undefined, false],
  ])('isSlugValid(%s, %d, %d) -> %s', (a, b, c, expected) => {
    expect(isSlugValid(a, b, c)).toBe(expected);
  });
});

describe('isPasswordValid', () => {
  test.each([
    // valid
    ['aaaaaA7!', undefined, undefined, true],
    ['aA1!aaaaK', undefined, undefined, true],
    ['Jes15-Graterol_.', undefined, undefined, true],
    ['Herassio-.5', undefined, undefined, true],
    ['PythonWiz333@', undefined, undefined, true],
    ['restAPI12.-_', undefined, undefined, true],
    ['@>|4xtZx', undefined, undefined, true],
    ['zR<q%+r2C,&fy.SE&~.(REXTqe4K[?>GCi_]|52QGzl&6+ru0!', undefined, undefined, true],
    [
      'f[(44fCFUn;%5_&:)QWl8|cnH>dC[hnP^%T>_X.k0:>jd)qERc_-!HkBn.pc@^8!BpxfRP)2MH1/zoID8aHU/^RgKj#ylC8P6B-tl#!M6/_LBx^o~0Wle/_MADm++|:/</Vm/pOPktJhVT>:R~?&,nsf]shnBVom7tDRklH*D-xXI~:bu]vRiSg^AWpC7RH]c#KRe^-:(CKrElFg>8/En]CI]c*o__7Q;!@,XkJN+vdVzK/^m?J]k8,/t@rQ/fjH?fb;x/_rxe,kf5y](#*XF<*H,mAy#p%H^TTGl(NdW,bt<dd1ahaV9W@5.^/Amr40VE<SVl1~cnhs(&kTNoo(Dy/LOT3a2(zgm>]CUG%AvD^*_YYZe~z6Pl~69dv,Mijc-fZ>&wJ(LxRF1#KjPqfq1?l6H+7qWz/H/hjed)s>W)n*jid*U|kx>7q772EVtpAjzB.@1Oij-wC8M/fsHG?5N9)g)c#!iPuY8l.rCrY,?qAyu_R(hl;op?2_Lk?^MIUayzz1r(JU7c!eUgS:jc><RCwnXrB/(!Kg%[ie>eBMa|bRk05!+2/.;ZfXnrFTA3b.kB5GCR+?gN3b?QMf<fZ21Tz@N[--HeS!YO<.Gt8Khze9[RCX&wzL()kMJoa0DhH7a8,rJg+agmuc(d:NbHpLFm|a6fB4SoH|Eg_eOy9lT|Woz3&>#1TPX?&|%C6MX+rK12m1:#z^^d|lxB![>a>ySJTTG+!XvO?objieNyXB@&9%n|QzXdSK@f+!ov~dsF;7:@uHF32d(&ul^qP,(?HnX);67*Fw&/@B.k~l&9~,**H|d2V9?C2Xoj6l%zU%B+?uuzhSrB>r8)tJ5/,H+fl4&+~>],l.0vn&df*Z~p76x%a|7TrZ(Sl|<O|:%m#b#h[k.y5HdC8gBZGu9,H[-6Q%NEHCLQ>/J|9gNtcVa4Li<o)reeKRV@_CMf]F,i_Zkh.iCz<Ld9f*v4b25wKEABcj&ABebXbIQ/pq1N0dVW|(o9_O2Bpx35P).d+r?WkX,?s%FI4?PVw<@pBOR&qKR]nrBG9^r@~tDn)+xG5-!OVdw^xnnvDv0H*]m3E%2)7|!QM;/L:gh#zNd59pc9U5fy&s%.bu@5@jai8Of0/e^>HOykhW+0S[s+M~5.<|ulCOz8l@EK*WlTwF.h2xb3(/<|OTy6!9|#PZUa,BVZgFue12+:45-z1|9*D-RZ8KC6~#>KSls>(Y%88blLU(gDPPp+PQo*1GOY&A~gLV%^U3<amtsS<rs&_hQ^c3C;H!wc.C2j!<rvav/%TkAI%kD@.?,#KX*SV+DI0YCxXh^!FfSIugN</jVS7y&J!-3cLMQgDK1-?nBecH,~p2KXcF-4ykz,&wOMJ7d3l*HsY-^Ogn:MD3E+j3Gq3.gl9B1T8XxPWt(0mK?Eyu1#t/@ge+b~.Iw?4CQ)UI?2Y4^O5M@P-JPY>Q_i1]o!6B#O)o:/W>*#|+)My>9fj~))]Ikbyv1Ph[K[+0rs+3HhqAVxtAuoTa+0]K4_,o0IuE0Dmxk?agyA7X__KR)HczHPT?&F+~M4du|vy]>e;5ms?lea*@Vm9H@M1A11#ukC@l<M/cIAukW5]VIdTL(OfLG>wR.9>5?b*Xw+^C(%%z!nIiq.>iJVzX_BT>]KKJ5o[A_ZK;C1z+I>vL-_4fyT2r>b|Dg!r.eta:hzU]Of;xqu9ctq1qgz.PTOe!nUYnOlOd|G[f;eIU0B~5pT88SZs,)~<XwX0]]mmVwiwQH8en%)E*m&!a)qWFzfKFkuc21++O44FF/YJJE3^7enkN5;uTcVZ35plA:J7;-:~)nz.8.@+mYpSUCG6JV>0(3|8Yipds|,OpK1/b)TJn6Nt~%Jb*0J5EIIlAADs-38Kcf<vO<a],z-B@^|CLng2[6:40q6v9v1PdYPzmzls4A-iDh1#JA21DA#kch69ql+Bnm2bc%lI>y@m_LJu>@~R<gwvXF(ahnlrnZ_]cf,mNMXaiIYfr#Nm,N@mXC@b^8;wr3F#MX[<1?7mKvTnE:m~+KL,,1Z&FPpsD)|DuHHXRBTi2',
      undefined,
      undefined,
      true,
    ],

    // ranges
    ['aA7!', 5, 8, false],
    ['aA7!a', 5, 8, true],
    ['aA7!ab', 5, 8, true],
    ['aA7!abc', 5, 8, true],
    ['aA7!abcd', 5, 8, true],
    ['aA7!abcde', 5, 8, false],

    // invalid
    [undefined, undefined, undefined, false],
    [null, undefined, undefined, false],
    [{}, undefined, undefined, false],
    [[], undefined, undefined, false],
    ['a', undefined, undefined, false],
    ['JESUSGRATEROL@', undefined, undefined, false],
    ['Jes15-G', undefined, undefined, false],
    ['@@', undefined, undefined, false],
    ['jes15-gratero_.as', undefined, undefined, false],
    ['jesu()', undefined, undefined, false],
    ['asdjkhxaslkdj546512asdkasd', undefined, undefined, false],
    ['', undefined, undefined, false],
    ['          ', undefined, undefined, false],
    ['12345678', undefined, undefined, false],
    ['jesSS-gratero_.as', undefined, undefined, false],
    ['aaaaaaaa', undefined, undefined, false],
    ['aaaa1111', undefined, undefined, false],
    ['!!!!!!!!', undefined, undefined, false],
    ['AAAAAAAA', undefined, undefined, false],
    ['AAAAAA665', undefined, undefined, false],
    ['A5/5fZf', undefined, undefined, false],
    [123, undefined, undefined, false],
    [true, undefined, undefined, false],
  ])('isPasswordValid(%s, %d, %d) -> %s', (a, b, c, expected) => {
    expect(isPasswordValid(a, b, c)).toBe(expected);
  });
});

describe('isOTPSecretValid', () => {
  test.each([
    // valid
    ['NB2RGV2KAY2CMACD', true],
    ['KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD', true],
    ['KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLDKVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD', true],
    ['K4BCGQYENRTSKTSX', true],
    ['KB3XO6INJQ6GCGLN', true],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[{}], false],
    ['', false],
    ['5', false],
    ['......', false],
    ['45654A', false],
    ['1234567', false],
    [true, false],
    [123456, false],
    [6541, false],
    ['NB2RGV2KAY2CMCD', false],
    ['KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLDKVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLDX', false],
  ])('isOTPSecretValid(%s) -> %s', (a, expected) => {
    expect(isOTPSecretValid(a)).toBe(expected);
  });
});

describe('isOTPTokenValid', () => {
  test.each([
    // valid
    ['123456', true],
    ['000000', true],
    ['987654', true],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[{}], false],
    ['', false],
    ['5', false],
    ['......', false],
    ['45654A', false],
    ['1234567', false],
    ['123$67', false],
    [true, false],
    [123456, false],
    [6541, false],
  ])('isOTPTokenValid(%s) -> %s', (a, expected) => {
    expect(isOTPTokenValid(a)).toBe(expected);
  });
});

describe('isJwtValid', () => {
  test.each([
    // valid
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      true,
    ],
    [
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9.u7ZBa9RB8U4QL8eBk4hmsjg8oFW19AHuen12c8CvLMj0IQUsNqeC-vwNQvAINpgBM0bzDf5cotyrUzf55eXch6mzfKMa-OJXguO-lARp4fc40HaBWbfnEvGe7yEgSESkt6gJNuprG51A6f4AJyNlXG_3u7O4bAMwiPZJc3AAU84_JXC7Vlq1X3FMaLVGmZdxzA4TvYZEiTt_KHoA49UgzeZtNXo3YiDq-GgL1eV8Li01fwy-M--xzbp4cPcY89jkPyYxUIJEoITOULr3zXQwRfYVe6i0P28oyu5ZzAwYCajBb2T98zN7sFJarNmtcxSKNfhCPnMVn3wrpxx4_Kd2Pw',
      true,
    ],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIzNDU2Nzg5LCJuYW1lIjoiSm9zZXBoIn0.OpOSSw7e485LOP5PrzScxHb7SR6sAOMRckfFwi4rp7o',
      true,
    ],
    [
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhYmNkMTIzIiwiZXhwaXJ5IjoxNjQ2NjM1NjExMzAxfQ.3Thp81rDFrKXr3WrY1MyMnNK8kKoZBX9lg-JwFznR-M',
      true,
    ],
    [
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE3MTk1MjA4MjUsImV4cCI6MTc1MTA1NjgyNSwiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoianJvY2tldEBleGFtcGxlLmNvbSIsIkdpdmVuTmFtZSI6IkpvaG5ueSIsIlN1cm5hbWUiOiJSb2NrZXQiLCJFbWFpbCI6Impyb2NrZXRAZXhhbXBsZS5jb20iLCJSb2xlIjpbIk1hbmFnZXIiLCJQcm9qZWN0IEFkbWluaXN0cmF0b3IiXX0.mDxqZrLnoLmafT6pUfw2zR-ZtwQWXPsn08aVfMR-le0',
      true,
    ],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[{}], false],
    ['', false],
    ['5', false],
    ['......', false],
    ['45654A', false],
    ['1234567', false],
    [true, false],
    [123456, false],
    [6541, false],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQSflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      false,
    ],
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', false],
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', false],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
      false,
    ],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
      false,
    ],
    [
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9u7ZBa9RB8U4QL8eBk4hmsjg8oFW19AHuen12c8CvLMj0IQUsNqeC-vwNQvAINpgBM0bzDf5cotyrUzf55eXch6mzfKMa-OJXguO-lARp4fc40HaBWbfnEvGe7yEgSESkt6gJNuprG51A6f4AJyNlXG_3u7O4bAMwiPZJc3AAU84_JXC7Vlq1X3FMaLVGmZdxzA4TvYZEiTt_KHoA49UgzeZtNXo3YiDq-GgL1eV8Li01fwy-M--xzbp4cPcY89jkPyYxUIJEoITOULr3zXQwRfYVe6i0P28oyu5ZzAwYCajBb2T98zN7sFJarNmtcxSKNfhCPnMVn3wrpxx4_Kd2Pw',
      false,
    ],
    [
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9',
      false,
    ],
    ['eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.', false],
    ['eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', false],
    ['a.a.a', false],
    ['!a.a.a', false],
    ['!a.a@.a', false],
    ['!a.a@.a#', false],
    [
      'a.a.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      false,
    ],
  ])('isJwtValid(%s) -> %s', (a, expected) => {
    expect(isJwtValid(a)).toBe(expected);
  });
});

describe('isAuthorizationHeaderValid', () => {
  test.each([
    // valid
    [
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      true,
    ],
    [
      'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9.u7ZBa9RB8U4QL8eBk4hmsjg8oFW19AHuen12c8CvLMj0IQUsNqeC-vwNQvAINpgBM0bzDf5cotyrUzf55eXch6mzfKMa-OJXguO-lARp4fc40HaBWbfnEvGe7yEgSESkt6gJNuprG51A6f4AJyNlXG_3u7O4bAMwiPZJc3AAU84_JXC7Vlq1X3FMaLVGmZdxzA4TvYZEiTt_KHoA49UgzeZtNXo3YiDq-GgL1eV8Li01fwy-M--xzbp4cPcY89jkPyYxUIJEoITOULr3zXQwRfYVe6i0P28oyu5ZzAwYCajBb2T98zN7sFJarNmtcxSKNfhCPnMVn3wrpxx4_Kd2Pw',
      true,
    ],
    [
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIzNDU2Nzg5LCJuYW1lIjoiSm9zZXBoIn0.OpOSSw7e485LOP5PrzScxHb7SR6sAOMRckfFwi4rp7o',
      true,
    ],
    [
      'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhYmNkMTIzIiwiZXhwaXJ5IjoxNjQ2NjM1NjExMzAxfQ.3Thp81rDFrKXr3WrY1MyMnNK8kKoZBX9lg-JwFznR-M',
      true,
    ],
    [
      'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE3MTk1MjA4MjUsImV4cCI6MTc1MTA1NjgyNSwiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoianJvY2tldEBleGFtcGxlLmNvbSIsIkdpdmVuTmFtZSI6IkpvaG5ueSIsIlN1cm5hbWUiOiJSb2NrZXQiLCJFbWFpbCI6Impyb2NrZXRAZXhhbXBsZS5jb20iLCJSb2xlIjpbIk1hbmFnZXIiLCJQcm9qZWN0IEFkbWluaXN0cmF0b3IiXX0.mDxqZrLnoLmafT6pUfw2zR-ZtwQWXPsn08aVfMR-le0',
      true,
    ],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[{}], false],
    ['', false],
    ['5', false],
    ['......', false],
    ['45654A', false],
    ['1234567', false],
    [true, false],
    [123456, false],
    [6541, false],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQSflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      false,
    ],
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', false],
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', false],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
      false,
    ],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
      false,
    ],
    [
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9u7ZBa9RB8U4QL8eBk4hmsjg8oFW19AHuen12c8CvLMj0IQUsNqeC-vwNQvAINpgBM0bzDf5cotyrUzf55eXch6mzfKMa-OJXguO-lARp4fc40HaBWbfnEvGe7yEgSESkt6gJNuprG51A6f4AJyNlXG_3u7O4bAMwiPZJc3AAU84_JXC7Vlq1X3FMaLVGmZdxzA4TvYZEiTt_KHoA49UgzeZtNXo3YiDq-GgL1eV8Li01fwy-M--xzbp4cPcY89jkPyYxUIJEoITOULr3zXQwRfYVe6i0P28oyu5ZzAwYCajBb2T98zN7sFJarNmtcxSKNfhCPnMVn3wrpxx4_Kd2Pw',
      false,
    ],
    [
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9',
      false,
    ],
    ['eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.', false],
    ['eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', false],
    ['a.a.a', false],
    ['!a.a.a', false],
    ['!a.a@.a', false],
    ['!a.a@.a#', false],
    [
      'a.a.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      false,
    ],
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      false,
    ],
    [
      'BearereyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFuZHJvaWQiLCJhdWQiOiJhbmRyb2lkIiwiaXNzIjoiYXBpLnNvY2lhbGRlYWwubmwiLCJtZW1iZXIiOnsibmFtZSI6ImVyaWsifSwiZXhwIjoxNDUyMDgzMjA3LCJpYXQiOjE0NTE5OTY4MDd9.u7ZBa9RB8U4QL8eBk4hmsjg8oFW19AHuen12c8CvLMj0IQUsNqeC-vwNQvAINpgBM0bzDf5cotyrUzf55eXch6mzfKMa-OJXguO-lARp4fc40HaBWbfnEvGe7yEgSESkt6gJNuprG51A6f4AJyNlXG_3u7O4bAMwiPZJc3AAU84_JXC7Vlq1X3FMaLVGmZdxzA4TvYZEiTt_KHoA49UgzeZtNXo3YiDq-GgL1eV8Li01fwy-M--xzbp4cPcY89jkPyYxUIJEoITOULr3zXQwRfYVe6i0P28oyu5ZzAwYCajBb2T98zN7sFJarNmtcxSKNfhCPnMVn3wrpxx4_Kd2Pw',
      false,
    ],
    [
      'Bear eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIzNDU2Nzg5LCJuYW1lIjoiSm9zZXBoIn0.OpOSSw7e485LOP5PrzScxHb7SR6sAOMRckfFwi4rp7o',
      false,
    ],
    [
      ' eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhYmNkMTIzIiwiZXhwaXJ5IjoxNjQ2NjM1NjExMzAxfQ.3Thp81rDFrKXr3WrY1MyMnNK8kKoZBX9lg-JwFznR-M',
      false,
    ],
    ['Bearer', false],
    ['Bearer ', false],
    ['Bearer     ', false],
    ['Bearer asd#2123', false],
  ])('isAuthorizationHeaderValid(%s) -> %s', (a, expected) => {
    expect(isAuthorizationHeaderValid(a)).toBe(expected);
  });
});

describe('isSemverValid', () => {
  test.each([
    // valid
    ['1.0.0', true],
    ['10.11.132', true],
    ['17.14.84', true],
    ['1.3.15426', true],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[{}], false],
    ['', false],
    ['5', false],
    ['......', false],
    ['45654A', false],
    ['1234567', false],
    [true, false],
    [123456, false],
    [6541, false],
    ['v1.0.0', false],
    ['..', false],
    ['...', false],
    ['a.a.a', false],
  ])('isSemverValid(%s) -> %s', (a, expected) => {
    expect(isSemverValid(a)).toBe(expected);
  });
});

describe('isUrlValid', () => {
  test.each([
    // valid
    ['https://jesusgraterol.dev', true],
    ['https://www.jesusgraterol.dev', true],
    ['https://balancer.jesusgraterol.dev', true],
    ['https://developer.mozilla.org/en-US/docs/Web/API/URL/URL', true],
    ['https://mail.proton.me/u/0/inbox', true],
    [
      'https://firebasestorage.googleapis.com/v0/b/jesus-graterol.appspot.com/o/public%2Feducation%2Fbooks%2Fjwt-handbook-v0_14_1.pdf?alt=media&token=661d3241-c075-4951-b271-ad155d8cf6c2',
      true,
    ],
    [
      'gs://jesus-graterol.appspot.com/public/education/data_science_machine_learning/kaggle_raw_certificates/intro_to_deep_learning.png',
      true,
    ],
    [
      'https://firebasestorage.googleapis.com/v0/b/jesus-graterol.appspot.com/o/public%2Feducation%2Fdata_science_machine_learning%2Fkaggle_raw_certificates%2Fintro_to_deep_learning.png?alt=media&token=e6ac6715-11d9-4d97-b94e-fe2ac1fe255f',
      true,
    ],

    // invalid
    [undefined, false],
    [null, false],
    [{}, false],
    [[{}], false],
    ['', false],
    ['5', false],
    ['......', false],
    ['45654A', false],
    ['1234567', false],
    [true, false],
    [123456, false],
    [6541, false],
    ['v1.0.0', false],
    ['..', false],
    ['...', false],
    ['a.a.a', false],
    ['jesusgraterol.dev', false],
    ['www.jesusgraterol.dev', false],
    ['balancer.jesusgraterol.dev', false],
    ['www.balancer.jesusgraterol.dev', false],
  ])('isUrlValid(%s) -> %s', (a, expected) => {
    expect(isUrlValid(a)).toBe(expected);
  });
});

describe('isUuidValid', () => {
  test.each(<Array<[unknown, IUuidVersion, boolean]>>[
    // valid
    ['fcd089f1-6a2c-48b8-b2d7-9faebd1fdfb6', 4, true],
    ['876cce51-a546-4256-a067-5bc7cdc673ca', 4, true],
    ['a2047635-3d32-4774-b83d-f9474b9606db', 4, true],
    ['62af1b6c-6e82-489f-89e4-a5f84b2ec7eb', 4, true],
    ['06ddec6e-a973-4bd0-b2c8-5b01233eee02', 4, true],
    ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 4, true],
    ['01695553-c90c-705a-b56d-778dfbbd4bed', 7, true],

    // invalid
    [undefined, 4, false],
    [null, 4, false],
    [{}, 4, false],
    [[], 4, false],
    ['a', 4, false],
    ['JESUSGRATEROL@', 4, false],
    ['Jes15-Gratero_.!', 4, false],
    ['@@', 4, false],
    ['Jes15-Gratero_.as', 4, false],
    ['jesu()', 4, false],
    ['asdjkhxaslkdj546512asdkasd', 4, false],
    ['', 4, false],
    [' ', 4, false],
    ['   ', 4, false],
    [123, 4, false],
    ['9b1deb4d-3b7d4bad-9bdd-2b0d7b3dcb6d', 4, false],
    ['9b1deb4d-3b7d4bad-9bdd-2b0d7b3dcb6d', 4, false],
    ['9b1deb4d-3%7d-4bad-9bdd-2b0d7b3d-b6d', 4, false],
    ['d9428888-122b-11e1-b85c-61cd3cbb3210', 4, false],
    ['c106a26a-21bb-5538-8bf2-57095d1976c1', 4, false],
    ['630eb68f-e0fa-5ecc-887a-7c7a62614681', 4, false],
    ['06ddec6e-a973-4bd0-b2c8-5b01233eee02a', 4, false],
    ['06ddec6e-a973-4bd0-b2c8-5b01233eee0', 4, false],
    ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 7, false],
    ['01695553-c90c-705a-b56d-778dfbbd4bed', 4, false],
    [true, 4, false],
  ])('isUuidValid(%s, %d) -> %s', (a, b, expected) => {
    expect(isUuidValid(a, b)).toBe(expected);
  });
});

describe('isFileNameValid', () => {
  test.each([
    ['file.txt', true],
    ['.gitignore', true],
    ['a', true],
    ['report 2026-10-16.pdf', true],
    ['console.log', true],
    ['com0', true],
    ['a'.repeat(255), true],
    ['é'.repeat(127), true],
    ['', false],
    ['.', false],
    ['..', false],
    ['con', false],
    ['CON.txt', false],
    ['lpt9.md', false],
    ['nul', false],
    ['Aux.tar.gz', false],
    ['a<b', false],
    ['a>b', false],
    ['a:b', false],
    ['a"b', false],
    ['a/b', false],
    ['a\\b', false],
    ['a|b', false],
    ['a?b', false],
    ['a*b', false],
    ['\u0001', false],
    ['a\u007fb', false],
    ['name.', false],
    ['name ', false],
    ['a'.repeat(256), false],
    ['é'.repeat(128), false],
    [undefined, false],
    [123, false],
  ])('isFileNameValid(%j) -> %s', (value, expected) => {
    expect(isFileNameValid(value)).toBe(expected);
  });

  test.each([
    ['abcd', 4, true],
    ['abcde', 4, false],
    ['éé', 4, true],
    ['ééé', 4, false],
  ])('isFileNameValid(%s, %d) -> %s', (value, maxBytes, expected) => {
    expect(isFileNameValid(value, maxBytes)).toBe(expected);
  });
});

describe('isBigIntStringValid', () => {
  test.each([
    ['0', true],
    ['42', true],
    ['-42', true],
    ['9223372036854775807', true],
    ['-9223372036854775808', true],
    ['9223372036854775808', false],
    ['-9223372036854775809', false],
    ['007', false],
    ['-0', false],
    ['+5', false],
    ['1.0', false],
    ['1e3', false],
    [' 5', false],
    ['', false],
    [5, false],
    [5n, false],
    [null, false],
  ])('isBigIntStringValid(%o) -> %o', (value, expected) => {
    expect(isBigIntStringValid(value)).toBe(expected);
  });

  test.each([
    ['1', 1n, undefined, true],
    ['0', 1n, undefined, false],
    ['100', 1n, 100n, true],
    ['101', 1n, 100n, false],
    ['-1000', -100n, 5n, false],
    ['-99', -100n, 5n, true],
    ['99', -100n, 5n, false],
    ['9'.repeat(1_000_000), undefined, undefined, false],
    [`-${'9'.repeat(1_000_000)}`, undefined, undefined, false],
    ['1'.repeat(30), 0n, 10n ** 40n, true],
  ])('isBigIntStringValid(%s, %s, %s) -> %o', (value, min, max, expected) => {
    expect(isBigIntStringValid(value, min, max)).toBe(expected);
  });
});
