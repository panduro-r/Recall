from hosted_app import handler as RecallHandler


# Vercel statically discovers a local class; an imported name is not an entrypoint.
class handler(RecallHandler):
    pass
