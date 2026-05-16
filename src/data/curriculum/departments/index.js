import * as CE_mod from './CE/index.js';
import * as EEE_mod from './EEE/index.js';
import * as ME_mod from './ME/index.js';
import * as CSE_mod from './CSE/index.js';
import * as ECE_mod from './ECE/index.js';
import * as IPE_mod from './IPE/index.js';
import * as BECM_mod from './BECM/index.js';
import * as Arch_mod from './Arch/index.js';
import * as URP_mod from './URP/index.js';
import * as LE_mod from './LE/index.js';
import * as TE_mod from './TE/index.js';
import * as BME_mod from './BME/index.js';
import * as MSE_mod from './MSE/index.js';
import * as ESE_mod from './ESE/index.js';
import * as ChE_mod from './ChE/index.js';
import * as MTE_mod from './MTE/index.js';

const CE  = CE_mod.CE_DEPARTMENT || CE_mod.CE || CE_mod.default || Object.values(CE_mod)[0];
const EEE = EEE_mod.EEE_DEPARTMENT || EEE_mod.EEE || EEE_mod.default || Object.values(EEE_mod)[0];
const ME  = ME_mod.ME_DEPARTMENT || ME_mod.ME || ME_mod.default || Object.values(ME_mod)[0];
const CSE = CSE_mod.CSE_DEPARTMENT || CSE_mod.CSE || CSE_mod.default || Object.values(CSE_mod)[0];
const ECE = ECE_mod.ECE_DEPARTMENT || ECE_mod.ECE || ECE_mod.default || Object.values(ECE_mod)[0];
const IPE = IPE_mod.IPE_DEPARTMENT || IPE_mod.IPE || IPE_mod.default || Object.values(IPE_mod)[0];
const BECM= BECM_mod.BECM_DEPARTMENT || BECM_mod.BECM || BECM_mod.default || Object.values(BECM_mod)[0];
const Arch= Arch_mod.Arch_DEPARTMENT || Arch_mod.Arch || Arch_mod.default || Object.values(Arch_mod)[0];
const URP = URP_mod.URP_DEPARTMENT || URP_mod.URP || URP_mod.default || Object.values(URP_mod)[0];
const LE  = LE_mod.LE_DEPARTMENT || LE_mod.LE || LE_mod.default || Object.values(LE_mod)[0];
const TE  = TE_mod.TE_DEPARTMENT || TE_mod.TE || TE_mod.default || Object.values(TE_mod)[0];
const BME = BME_mod.BME_DEPARTMENT || BME_mod.BME || BME_mod.default || Object.values(BME_mod)[0];
const MSE = MSE_mod.MSE_DEPARTMENT || MSE_mod.MSE || MSE_mod.default || Object.values(MSE_mod)[0];
const ESE = ESE_mod.ESE_DEPARTMENT || ESE_mod.ESE || ESE_mod.default || Object.values(ESE_mod)[0];
const ChE = ChE_mod.ChE_DEPARTMENT || ChE_mod.ChE || ChE_mod.default || Object.values(ChE_mod)[0];
const MTE = MTE_mod.MTE_DEPARTMENT || MTE_mod.MTE || MTE_mod.default || Object.values(MTE_mod)[0];

export const DEPARTMENTS = {
  CE,
  EEE,
  ME,
  CSE,
  ECE,
  IPE,
  BECM,
  Arch,
  URP,
  LE,
  TE,
  BME,
  MSE,
  ESE,
  ChE,
  MTE,
};
