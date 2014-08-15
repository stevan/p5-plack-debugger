package Plack::Debugger::Storage;

use strict;
use warnings;

use File::Spec;

sub new {
    my $class = shift;
    my %args  = @_;

    die "You must specify a data directory for collecting debugging data"
        unless defined $args{'data_dir'};

    die "You must specify a valid & writable data directory"
        unless -d $args{'data_dir'} && -w $args{'data_dir'};

    foreach (qw[ serializer deserializer ]) {
        die "You must provide a $_ callback"
            unless defined $args{ $_ };

        die "The $_ callback must be a CODE reference"
            unless ref $args{ $_ } 
                && ref $args{ $_ } eq 'CODE';
    }

    bless {
        data_dir     => $args{'data_dir'},
        serializer   => $args{'serializer'},
        deserializer => $args{'deserializer'},
        filename_fmt => $args{'filename_fmt'} || '%s',
    } => $class;
}

# accessors 

sub data_dir     { (shift)->{'data_dir'}     } # directory where collected debugging data is stored
sub serializer   { (shift)->{'serializer'}   } # CODE ref serializer for data into data-dir
sub deserializer { (shift)->{'deserializer'} } # CODE ref deserializer for data into data-dir
sub filename_fmt { (shift)->{'filename_fmt'} } # format string for filename, takes the request UID (optional)

# ...

sub store {
    my ($self, $request_uid, $results) = @_;
    my $file = File::Spec->catfile( $self->data_dir, sprintf $self->filename_fmt => $request_uid );
    my $fh   = IO::File->new( $file, '>' ) or die "Could not open file($file) for writing because: $!";
    $fh->print( $self->serializer->( $results ) );
    $fh->close;
}

sub load {
    my ($self, $request_uid) = @_;
    my $file = File::Spec->catfile( $self->data_dir, sprintf $self->filename_fmt => $request_uid );
    my $fh   = IO::File->new( $file, '<' ) or die "Could not open file($file) for reading because: $!";
    my $results = $self->deserializer->( join '' => <$fh> ) ;
    $fh->close;
    $results;
}

1;

__END__