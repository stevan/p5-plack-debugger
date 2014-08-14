package Plack::Debugger::Storage;

use strict;
use warnings;

use File::Spec;
use POSIX qw[ strftime ];

use Plack::Util::Accessor (
    'data_dir',     # directory where collected debugging data is stored
    'serializer',   # CODE ref serializer for data into data-dir
    'deserializer', # CODE ref deserializer for data into data-dir
    'filename_gen', # CODE ref for generating filenames for data-dir
);

sub new {
    my $class = shift;
    my %args  = @_;

    die "You must specify a data directory for collecting debugging data"
        unless exists $args{'data_dir'};

    die "You must specify a valid & writable data directory"
        unless -d $args{'data_dir'} && -w $args{'data_dir'};

    die "You must provide a serializer for writing data"
        unless exists $args{'serializer'};

    die "You must provide a deserializer for writing data"
        unless exists $args{'deserializer'};

    unless (exists $args{'filename_gen'}) {
        my $FILENAME_ID = 0;
        $args{'filename_gen'} = sub { sprintf "%s-%s", strftime("%F_%T", localtime), ++$FILENAME_ID };
    }

    bless {
        data_dir     => $args{'data_dir'},
        serializer   => $args{'serializer'},
        deserializer => $args{'deserializer'},
        filename_gen => $args{'filename_gen'},
    } => $class;
}

sub store {
    my ($self, $results) = @_;
    my $file = File::Spec->catfile( $self->data_dir, $self->filename_gen->() );
    my $fh   = IO::File->new( $file, '>' ) or die "Could not open file($file) for writing because: $!";
    $fh->print( $self->serializer->( $results ) );
    $fh->close;
}

sub load {
    my ($self, $filename) = @_;
    my $file = File::Spec->catfile( $self->data_dir, $filename );
    my $fh   = IO::File->new( $file, '<' ) or die "Could not open file($file) for reading because: $!";
    my $results = $self->deserializer->( join '' => <$fh> ) ;
    $fh->close;
    $results;
}

1;

__END__