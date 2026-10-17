import { test } from 'vitest';
import { isStringValid } from './index.js';

/* ************************************************************************************************
 *                                             MOCKS                                              *
 ************************************************************************************************ */

const isPasswordValid1 = (
  value: unknown,
  minLength: number = 8,
  maxLength: number = 2048,
): value is string =>
  isStringValid(value, minLength, maxLength) &&
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]+$/.test(value);

const isPasswordValid2 = (
  value: unknown,
  minLength: number = 8,
  maxLength: number = 2048,
): value is string =>
  typeof value === 'string' &&
  new RegExp(
    `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_])[A-Za-z\\d\\W_]{${minLength},${maxLength}}$`,
  ).test(value);

const PASS_1 = 'q&*Cv+oUe3SSccp|G>V-LDhGeb,CTJ04aGH:)^&M88(*G;fi*%';
const PASS_2 =
  'AckL,G!!i^^D4|B^?V.jg]1&VHUV,vo<gdWjnRYvidwpy:/C*TpqbRDGP,adZ~&PG>-6jR!|fv6U|EXiIn50g>.Sb@A!+v?u:zfU/v_w|%J))[AOv)QlN%y:q#8(J/qo-hqOdmxnMOl~X*!ZyG&:4,h!G-UIH>k-RD;S~VM5#qo~tjg%/APF(]Q[ROgcGNYyP;i?(PmdvlB/0K%Yde3cCt0/gsUq;S,P|I%kW6I)(218Z.k>U5v]Sd3woG)(IlL4qyA8I(A;Z+5k<(@IC@/Tm0.Itiaz%*<FprQ3uRE4[Bv.g&~<3aS2sTAZ4wmhdFT>?3sU|1n+_2gtGH!k;YhjoGxw/gY[-Y%4#FvF3J>33s,Jtb.JeHx#;Ki8F&rwU,6hH!zH^<zH97PDl,)8M(m6Dhtbw&C,Ho,hS.njTNa#:0U%bIduKS4#EsxZx-3U,!T+Bbl_GR!Qp3IqSO1TC@kVsjaU8n?qyNU,qI:<.op]mW+]CH~*6S-Q!~1T:]Q#tiaBoEiaEsbVm5U0~y,m*;9r|CO%OrWwTdW<bY*<2F+FQ0/N>;E2Ho~CAQZ:I,xc.w8uQL@>!vqO@&SB]|&]J5HgZX~&_&*5.g8]!F]gr~CA@u#qqozWt5>oloB]-N_FXfj~4#WWx#]^-(cO(0Qph+>~qS~lUmTSaYHTcSXBEFI_Ey!r~lwhwO_X|M%QAl-c<GoS>-YZgNgzQXz-F~x6E?:?t0i%%0.(r9neAs>i#XVd9f3U%H2Yl+w]fod!oL9mOM7LX9]@n19Y9]QC]>|MocJfjps+zuu9]&<[)>nWdlnZa,1U![!/2u];w*NF,CAZkYr<LDts]0S]|p)?dyOa[//O1sG1rEm)h&6Bx2&~n#]978WZdWvNUYn+X?qNF2<)CPdsx]@8y7ONMRmlf-W1*Gjl7J[ay3H&yABw.28AmFLrY;QW029WvuyGQa5SV4qduA8~Z<59UES7At]8RiFe:aED!ST95;#TH_ynWhItGBqT</jOr]Ke,beB2*E#7bgApUtV';
const PASS_3 =
  'XYtO&T?%?KfGNLRbwtWliNUp9fraUtw.SGfm|T|/)CPDfkrOObE[<F_,,gyz|nWNQk:;b6~UZ>xWfCg.[3qxYiM]!tq6r11L#LxrxJuRz/?71!3:n7Q@pMZ1oi0S54(tklwrS;iL(HpquC0!!l%~^dFk%.MJrb:b~+]6:s3<QU9VKG/Y3qB]f>45Yr2ZX~w-yL@sK6[@R2w9TLA2PcSi:hEU49A)v~doQhbl&CS1zCL<?kf&g+4w~p9JJPhmzaAP891;rx3Nq7CQG@^#-@Xsv1ae>8.;+^TcX>bjwXv#U_~|~,a4~&Tmug,(i6*vK2^,6Q|r>~VkW*.F#JjZ%J>W4&dy/L&J5-Fk00@F6mKmo1)_9#UA.<@CBL!fj:%5,ac_rm&~X9q+X2c:8zcMK]qD!T.1I^M8!U*)XobWg,nP%J<]g+%zYo(,+QAAsyjx-AkxIs@_8izx&9ME%E%(ke4ru6urw3xo0aW3DuWg2~od:jGJ9u+MkljDI%_B5Ns0WHD?)O;iJ/!9@lJitzCtonf_G)R!T.?rFoYobKSE.?UNyb2|pB8p?t<HbI;-sUxsN4Sh?V?,/o@)@w?0Cggk>JSpfRT(nPTnEV[[d+kK%yz(|7|XB4_?uyC,pTdUI#JjUy4P@^W:!t+7!~>QD[6MTa(hr|R<5OMCNCEB<xujjvHc5D9)4L|/VNRbuS58Y*EYxmb1A%-:)?_c6EKE::w|xv2PVa5rx[CIu5aRCNjPgtlK<6dmC:pLHj8,Zi4MZ!c^//9q6o)QWO2:G63(7uYP@EgM;(A,pGM7Ff?6!x34_wt<AlErUS~kI*5DQl[PVja9Kt(9^(ciFf@Lp97|*w6Wy~(4Pf%W0~Ek1N)wwE|hCmYz-S-YOk4jZ<Z6]2LTBT,lK|PT~C<:n|#gn6ewSjYlT_,4WufzaV)-#MMP8U>..A<?B?~%!lz2*GyXj4~9.3qF(C%Zc*?_*H-&v5k#hUID4-smao|Pk-]9B%r!2>n~/IW,lA]gq[XQOV]azms%~1NMNE||3W96hIfu-hU(|~S(&ihqymQeo8hU)3eRmsp>4*Kbgu#l6^,;rr[53JTDM><&%a*@F>56#7fO^62g:eFM4g1~wV3nJ|Ew4jQ1vTwj_;u2ya~8rdx#0<JjhbumDmBCJ!DSu/[@p9YEAj6w%cJ|tSBjTqoPFkG#hfoXVPz.6b1lA+2<GV[#XtD!.y9!GL@Z[?XqsuGLbP]:/+tN2?%nV6;TJG**uz_bo:1%C*,mT-_FV%00->fo?2+lRpL8WKb,5KqgJtP)uz7T(&4P0I.d%[DQmd_HN[NDTM/U6fLN.VD0/)S@t2a~:k(JL)e+/mFDWpfC%1;nohs?j[w?A?KDxU1G09*mwK-RnhZ_<t!E0iB<>JD)cck^3.^<uIA83?9.CJD-wwGeqeS7FlWnQO7gF<Bx89OZ.hL+yF|cs2(tcH15e;,ccQP&q7AE.k1_1.,8s^AisTTA-y,3OkSp>UFrVs,0Sx-oS@rSq]^cCPORI^HvH[cJQgB_/~lgag8JLUcv+4OwDcupx_J(4xXXr7Hk./jIls-GQ9@m,QiW<oXuM-CfC8_%&KV;c_h0~Sx#WE#V1]&bfV_Q/p]LTsudxH(-J-mj[^xdLl50B1W8d8F[!9S?D0aLUrDlM]?^HT>wH[jacc43H]QW92,@6AR4:ZljtMB[Yi:H)G*?i#-ics%,/U<e.:qHP[tUQ]fbyHuYMMs9^K[+dz|f].!-:6jz&)C9j7l[riD(W!tI.[oJYCPgH@|he+RoMe^6xO/b>SxBm3IXJKr&;mlJoJdGb@L??~neIBPhso>d/^|f,r0S!aMYAFR5Itq1;5EQN0VnykDYs*mkJ&F>o.z@-2Esp<)m/Kn5kG*VQrwJSx:(gIett%B~DB-B-9,N~fjF90eD!mt~gWoGL+uS+B(6UF&tj@xH.n_S(teUeTPHU/(z2XYPRDJ!1LjKxahhf:XY6TV3Z+/fWA4j>;3F%1!lzgfs6Rp_|bh<o0s&(rcv6;k.66c?(sAc9LjOl_kvSBta/_+nwsP7rg_@LCah';

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

test.skip('isPasswordValid', async ({ bench }) => {
  await bench.compare(
    bench('using isStringValid', () => {
      isPasswordValid1(PASS_1);
      isPasswordValid1(PASS_2);
      isPasswordValid1(PASS_3);
    }),
    bench('using only RegEx', () => {
      isPasswordValid2(PASS_1);
      isPasswordValid2(PASS_2);
      isPasswordValid2(PASS_3);
    }),
  );
});
