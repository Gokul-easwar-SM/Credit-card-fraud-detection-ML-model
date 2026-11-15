from sqlalchemy import text

from app.db.session import build_engine


def test_sqlite_engine_uses_wal_fk_and_busy_timeout(tmp_path):
    engine = build_engine(f"sqlite:///{tmp_path / 's.db'}")
    with engine.connect() as c:
        assert c.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert c.execute(text("PRAGMA busy_timeout")).scalar() == 5000
    engine.dispose()


def test_concurrent_reader_and_writer_do_not_block(tmp_path):
    """With WAL, a read transaction must not block a write on another connection."""
    engine = build_engine(f"sqlite:///{tmp_path / 'c.db'}")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE t (x INTEGER)"))
    reader = engine.connect()
    reader.execute(text("SELECT * FROM t")).fetchall()
    with engine.begin() as writer:  # would raise 'database is locked' without WAL
        writer.execute(text("INSERT INTO t VALUES (1)"))
    reader.close()
    engine.dispose()
