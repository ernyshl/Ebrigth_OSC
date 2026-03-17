import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// This uses the credentials from your .env.local file
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: Request) {
  try {
    const { day, selections, notes } = await request.json();
    const client = await pool.connect();

    try {
      // Start a transaction to ensure all data for the day is saved at once
      await client.query('BEGIN');

      // Loop through all staff columns for that day
      for (const key in selections) {
        if (key.startsWith(day)) {
          const parts = key.split('-'); // Format: day-slot-staff
          const slot = parts[1];
          const staff_col = parts[2];
          const staff_role = selections[key];
          
          // Find the specific note for this slot or leave blank
          const noteKey = `${day}-${slot}-notes`;
          const staff_note = notes[noteKey] || '';

          // This SQL command updates the row if it already exists for that day/time/person
          await client.query(`
            INSERT INTO manpower_schedule (day_name, time_slot, staff_col, staff_role, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (day_name, time_slot, staff_col) 
            DO UPDATE SET staff_role = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
          `, [day, slot, staff_col, staff_role, staff_note]);
        }
      }

      await client.query('COMMIT');
      return NextResponse.json({ message: `Successfully saved ${day} schedule!` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}