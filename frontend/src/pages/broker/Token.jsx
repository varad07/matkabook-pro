import { formatAmount, formatTime, formatPana } from '../../utils/format';

const BET_LABELS = {
  single_ank:   'Single Ank',
  jodi:         'Jodi',
  single_pana:  'Single Pana',
  double_pana:  'Double Pana',
  triple_pana:  'Triple Pana',
  pana:         'Pana',
};

export default function TokenSuccess({ data, onDone }) {
  const { token, batch, entries } = data;

  return (
    <div className="flex flex-col items-center min-h-full py-6">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-6">
        <span className="text-4xl">✓</span>
      </div>

      <h2 className="text-green-400 text-xl font-bold mb-1">Entry Submitted!</h2>
      <p className="text-gray-400 text-sm mb-8">Your bets have been recorded.</p>

      {/* Token card */}
      <div className="w-full max-w-sm bg-card border-2 border-gold/40 rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-400 text-xs uppercase font-bold mb-2">Token Number</p>
        <p className="text-gold text-2xl font-bold font-mono tracking-wider mb-4">{token}</p>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-gold/10 pt-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Market</p>
            <p className="text-white font-semibold">{batch?.market_name || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Session</p>
            <p className="text-white font-semibold capitalize">{batch?.session || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Time</p>
            <p className="text-white font-semibold">{batch?.submitted_at ? formatTime(batch.submitted_at) : formatTime(new Date().toISOString())}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Total Amount</p>
            <p className="text-gold font-bold">{formatAmount(batch?.total_amount || 0)}</p>
          </div>
        </div>
      </div>

      {/* Entries list */}
      <div className="w-full max-w-sm mb-8">
        <p className="text-gray-400 text-xs uppercase font-bold mb-3">Bets Submitted</p>
        <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
          {(entries || []).map((item, i) => (
            <div key={i} className={`flex justify-between items-center px-4 py-3 ${i > 0 ? 'border-t border-gold/5' : ''}`}>
              <div>
                <p className="text-white font-semibold font-mono">{formatPana(item.number)}</p>
                <p className="text-gray-500 text-xs">{BET_LABELS[item.bet_type] || item.bet_type}</p>
              </div>
              <p className="text-gold font-bold">{formatAmount(item.amount)}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onDone}
        className="w-full max-w-sm bg-gold hover:bg-darkgold text-black font-bold py-4 rounded-2xl text-lg transition-colors active:scale-95"
      >
        DONE
      </button>
    </div>
  );
}
