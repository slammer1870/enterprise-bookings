'use client'

import React from 'react'

interface Props {
  cellData: string;
}

const LastCheckInField: React.FC<Props> = ({ cellData }) => {
  if (!cellData) return null;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const isOverOneWeek = new Date(cellData) < oneWeekAgo;

  return (
    <div style={{ color: isOverOneWeek ? 'red' : 'inherit' }}>
      {new Date(cellData).toLocaleDateString()}
    </div>
  );
};

export default LastCheckInField;
