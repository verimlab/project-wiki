import React from 'react';
import { useVirtualTable } from '../virtual-table/VirtualTableContext';
import './VTChatLog.css';

export const VTChatLog: React.FC = () => {
  const { rollHistory } = useVirtualTable();

  return (
    <div className="vt-chat-log">
      {rollHistory.length === 0 && <div className="vt-chat-log-empty">Журнал бросков пуст</div>}
      {rollHistory.map((roll) => (
        <div key={roll.id} className="vt-chat-log-entry">
          <span>{roll.notation} =</span>
          <strong>{roll.value}</strong>
        </div>
      ))}
    </div>
  );
};
