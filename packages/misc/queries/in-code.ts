export function main() {
  const invalid = `
    select 
      *
    from 
      (
        select 1 as id, 'foo' as name
      ) left join (
        select 1 as id, 'bar' as type
      )
  `;
  const valid = `select 
      id
    from 
      (
        select 1 as id
        union all select 2 as id
      )`;
  console.log(invalid, valid);
}
