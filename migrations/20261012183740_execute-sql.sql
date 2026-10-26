CREATE OR REPLACE FUNCTION execute_sql(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    EXECUTE 'SELECT coalesce(json_agg(t)::jsonb, ''[]''::jsonb) FROM (' || query_text || ') t' INTO result;
    RETURN coalesce(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon, authenticated;
