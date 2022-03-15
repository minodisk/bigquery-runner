export function main() {
  const query1 = `
    select 
      *
    from 
      (
        select 1 as id, 'foo' as name
      ) left join (
        select 1 as id, 'bar' as type
      )
  `;
  const query2 = `select 
      ip
    from 
      (
        select 1 as id
        union all select 2 as id
      )`;
  console.log(query1, query2);
}
