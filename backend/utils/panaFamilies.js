const CUT = {
  '0':'5','1':'6','2':'7','3':'8','4':'9',
  '5':'0','6':'1','7':'2','8':'3','9':'4'
};

const ALL_VALID_PANAS = [
  // SP panas — 12 per ank, 10 anks = 120 total
  '128','137','146','236','245','290','380','470','489','560','678','579',
  '129','138','147','156','237','246','345','390','480','570','679','589',
  '120','139','148','157','238','247','256','346','490','580','670','689',
  '130','149','158','167','239','248','257','347','356','590','680','789',
  '140','159','168','230','249','258','267','348','357','456','690','780',
  '123','150','169','178','240','259','268','349','358','457','367','790',
  '124','160','179','250','269','278','340','359','368','458','467','890',
  '125','134','170','189','260','279','350','369','378','459','567','468',
  '126','135','180','234','270','289','360','379','450','469','478','568',
  '127','136','145','190','235','280','370','389','460','479','569','578',
  // DP panas — 9 per ank, 10 anks = 90 total
  '119','155','227','335','344','399','588','669',
  '110','228','255','336','499','660','688','778',
  '166','229','337','355','445','599','779','788',
  '112','220','266','338','446','455','699','770',
  '113','122','177','339','366','447','799','889',
  '114','277','330','448','466','556','880','899',
  '115','133','188','223','377','449','557','566',
  '116','224','233','288','440','477','558','990',
  '117','144','199','225','388','559','577','667',
  '118','226','244','299','334','488','668','677',
  // TP panas
  '111','222','333','444','555','666','777','888','999','000'
];

const validPanaSet = new Set(ALL_VALID_PANAS);

// Sort digits ascending, 0 always goes to the end (never first digit)
function formatPana(digitsArray) {
  const sorted = [...digitsArray].sort((a, b) => {
    if (a === '0') return 1;
    if (b === '0') return -1;
    return parseInt(a) - parseInt(b);
  });
  return sorted.join('');
}

function getAnk(pana) {
  const p = String(pana).padStart(3, '0');
  const sum = p.split('').reduce((acc, d) => acc + parseInt(d), 0);
  return String(sum % 10);
}

function getPanaType(pana) {
  const p     = String(pana).padStart(3, '0');
  const unique = new Set(p.split('')).size;
  if (unique === 1) return 'triple_pana';
  if (unique === 2) return 'double_pana';
  return 'single_pana';
}

/**
 * Family algorithm (CUT method):
 *   - For each of the 3 digit positions, independently choose
 *     the ORIGINAL digit OR its CUT.
 *   - This gives 2^3 = 8 combinations.
 *   - Apply formatPana, filter to valid panas, deduplicate, sort.
 */
function getFamilyByPana(inputPana) {
  const pana   = String(inputPana).padStart(3, '0');
  const digits = pana.split('');
  const cuts   = digits.map(d => CUT[d]);
  const pool   = [...new Set([...digits, ...cuts])];

  const results = [];

  for (let mask = 0; mask < 8; mask++) {
    // bit i = 0 → use digits[i]; bit i = 1 → use cuts[i]
    const combo     = digits.map((d, i) => ((mask >> i) & 1) ? cuts[i] : d);
    const formatted = formatPana(combo);
    if (!validPanaSet.has(formatted)) continue;        // must be valid pana (handles all invalid combos)
    if (!results.includes(formatted)) results.push(formatted);
  }

  results.sort((a, b) => parseInt(a) - parseInt(b));

  return { inputPana: pana, digits, cuts, pool, members: results, count: results.length };
}

function getSPByAnk(ank) {
  const members = ALL_VALID_PANAS
    .filter(p => getAnk(p) === String(ank) && getPanaType(p) === 'single_pana')
    .sort((a, b) => parseInt(a) - parseInt(b));
  return { ank: String(ank), type: 'SP', label: `Single Pana – Ank ${ank}`, members, count: members.length };
}

function getDPByAnk(ank) {
  const members = ALL_VALID_PANAS
    .filter(p => getAnk(p) === String(ank) && getPanaType(p) === 'double_pana')
    .sort((a, b) => parseInt(a) - parseInt(b));
  return { ank: String(ank), type: 'DP', label: `Double Pana – Ank ${ank}`, members, count: members.length };
}

function runTests() {
  const tests = [
    { pana: '120', expected: ['120','125','157','170','256','260','567','670'] },
    { pana: '123', expected: ['123','128','137','178','236','268','367','678'] },
    { pana: '111', expected: ['111','116','166','666'] },
    { pana: '440', expected: ['440','445','459','490','599','990'] },
    { pana: '345', expected: ['340','345','359','390','458','480','589','890'] },
    { pana: '670', expected: ['120','125','157','170','256','260','567','670'] },
  ];

  let allPass = true;
  tests.forEach(({ pana, expected }) => {
    const { members } = getFamilyByPana(pana);
    const got = [...members].sort();
    const exp = [...expected].sort();
    const pass = JSON.stringify(got) === JSON.stringify(exp);
    console.log(`Family of ${pana}: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!pass) { allPass = false; console.error('  Expected:', exp); console.error('  Got:     ', got); }
  });
  const t033 = getFamilyByPana('033');
  console.log(`033 test — pool: [${t033.pool}] members: [${t033.members}]`);
  if (allPass) console.log('All tests PASS ✅');
}

runTests();

module.exports = {
  getFamilyByPana, getSPByAnk, getDPByAnk,
  getAnk, getPanaType, formatPana,
  validPanaSet, ALL_VALID_PANAS, CUT,
};
